import esm from 'esm';
import Module from 'module';
import { resolve, join } from 'path';
import Etsx, { EtsxModule } from 'etsx';
import fs from 'graceful-fs';
import { startsWithRootAlias, startsWithSrcAlias } from '@etsx/utils';
export class Resolver extends EtsxModule {
  esm: NodeRequire;
  constructor(etsx: Etsx) {
    super(etsx)

    // 绑定上下文
    this.resolvePath = this.resolvePath.bind(this)
    this.resolveAlias = this.resolveAlias.bind(this)
    this.resolveModule = this.resolveModule.bind(this)
    this.requireModule = this.requireModule.bind(this)

    // ESM Loader
    this.esm = esm(module, {})
  }

  resolveModule(path: string): string | void {
    try {
      type Module = { _resolveFilename: (path: string, opt: { paths: string[]}) => string};
      return (Module as any as Module)._resolveFilename(path, {
        paths: this.options.modulesDir,
      })
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        return void 0
      } else {
        throw error
      }
    }
  }
  /**
   *
   * @param {String} path
   */
  resolveAlias(path: string): string {
    if (startsWithRootAlias(path)) {
      return join(this.options.dir.root, path.substr(2))
    }

    if (startsWithSrcAlias(path)) {
      return join(this.options.dir.src, path.substr(1))
    }

    return resolve(this.options.dir.src, path)
  }
  /**
   * 解析路径
   */
  resolvePath(path: string, { isAlias, isModule }: { isAlias?: boolean; isModule?: boolean; } = {}) {
    // 存在路径时快速返回
    if (fs.existsSync(path)) {
      return path
    }

    let resolvedPath

    // 使用 常规模块 尝试解析
    if (isModule !== false) {
      resolvedPath = this.resolveModule(path)
    }

    // 使用 别名 尝试解析
    if (!resolvedPath && isAlias !== false) {
      resolvedPath = this.resolveAlias(path)
    }

    // 直接不解析使用path
    if (!resolvedPath) {
      resolvedPath = path
    }

    let isDirectory

    // Check if resolvedPath exits and is not a directory
    if (fs.existsSync(resolvedPath)) {
      isDirectory = fs.lstatSync(resolvedPath).isDirectory()

      if (!isDirectory) {
        return resolvedPath
      }
    }

    const extensions = this.options.extensions

    // Check if any resolvedPath.[ext] or resolvedPath/index.[ext] exists
    for (const ext of extensions) {
      if (!isDirectory && fs.existsSync(resolvedPath + '.' + ext)) {
        return resolvedPath + '.' + ext
      }

      if (isDirectory && fs.existsSync(resolvedPath + '/index.' + ext)) {
        return resolvedPath + '/index.' + ext
      }
    }

    // If there's no index.[ext] we just return the directory path
    if (isDirectory) {
      return resolvedPath
    }

    // Give up
    throw new Error(`Cannot resolve "${path}" from "${resolvedPath}"`)
  }

  requireModule(path: string, { useESM, isAlias, intropDefault }: { useESM?: boolean, isAlias?: boolean, intropDefault?: boolean } = {}) {
    let resolvedPath = path
    let requiredModule

    let lastError

    // Try to resolve path
    try {
      resolvedPath = this.resolvePath(path, { isAlias })
    } catch (e) {
      lastError = e
    }

    // Disable esm for ts files by default
    if (useESM === undefined && /.ts$/.test(resolvedPath)) {
      useESM = false
    }

    // Try to require
    try {
      if (useESM === false) {
        requiredModule = require(resolvedPath)
      } else {
        requiredModule = this.esm(resolvedPath)
      }
    } catch (e) {
      lastError = e
    }

    // Introp default
    if (intropDefault !== false && requiredModule && requiredModule.default) {
      requiredModule = requiredModule.default
    }

    // Throw error if failed to require
    if (requiredModule === undefined && lastError) {
      throw lastError
    }

    return requiredModule
  }
}
export default Resolver
