
import fs from 'fs';
import path from 'path';
import Etsx from 'etsx';
import { chainFn, sequence } from '@etsx/utils';
import EtsxModule from './base-module';

const hash: (src: any) => string = require('hash-sum')

export type dst = string
export type template = string | {
  src: string,
  fileName: string,
  options: object,
}
export type dstemplate = {
  src: string,
  dst: dst,
  options: object,
}
export type moduleOpts = {}
export type moduleHandler = () => void
export type module = { src: string, options: moduleOpts, handler: moduleHandler }
export class ModuleContainer extends EtsxModule {
  requiredModules: Map<string, module>;
  /**
   * 构造函数
   * @param {Object} etsx
   */
  constructor(etsx: Etsx) {
    // 存储上下文
    super(etsx)
    // 存储一次性加载的模块的对象
    this.requiredModules = new Map()
  }

  async ready(): Promise<void> {
    // 调用模块处理前的钩子
    await this.etsx.callHook('modules:before', this, this.options.modules)

    // 按顺序加载每个模块
    await sequence(this.options.modules, this.addModule.bind(this))

    // 调用模块处理完成的钩子
    await this.etsx.callHook('modules:done', this)
  }

  addTemplate(template: template): dstemplate {
    /* istanbul ignore if */
    if (!template) {
      throw new Error('Invalid template:' + JSON.stringify(template))
    }

    // Validate & parse source
    const src = typeof template === 'string' ? template : template.src
    const srcPath = path.parse(src)
    /* istanbul ignore if */
    if (typeof src !== 'string' || !fs.existsSync(src)) {
      throw new Error('Template src not found:' + src)
    }

    // Generate unique and human readable dst filename
    const dst = (typeof template === 'object' ? template.fileName : '') ||
      path.basename(srcPath.dir) + `.${srcPath.name}.${hash(src)}` + srcPath.ext

    // Add to templates list
    const templateObj: dstemplate = {
      src,
      dst,
      options: (typeof template === 'object' ? template.options : {}) || {},
    }

    this.options.build.templates.push(templateObj)
    return templateObj
  }

  addPlugin(template: template) {
    const { dst } = this.addTemplate(template)

    // Add to etsx plugins
    this.options.plugins.unshift({
      src: path.join(this.options.buildDir, dst),
      ssr: template.ssr,
    })
  }

  addLayout(template: template, name: string) {
    const { dst, src } = this.addTemplate(template)

    // Add to nuxt layouts
    this.options.layouts[name || path.parse(src).name] = `./${dst}`

    // If error layout, set ErrorPage
    if (name === 'error') {
      this.addErrorLayout(dst)
    }
  }

  addErrorLayout(dst: dst) {
    const relativeBuildDir = path.relative(this.options.rootDir, this.options.buildDir)
    this.options.ErrorPage = `~/${relativeBuildDir}/${dst}`
  }

  /**
   * 添加中间件
   * @param {Function} middleware
   */
  addServerMiddleware(middleware) {
    this.options.serverMiddleware.push(middleware)
  }

  extendBuild(fn) {
    this.options.build.extend = chainFn(this.options.build.extend, fn)
  }

  extendRoutes(fn) {
    this.options.router.extendRoutes = chainFn(
      this.options.router.extendRoutes,
      fn,
    )
  }
/**
 * 一次性引入模块
 * @param {String|Object|Array} moduleOpts
 */
  requireModule(moduleOpts: moduleOpts) {
    return this.addModule(moduleOpts, true /* require once */)
  }

  /**
   * 添加模块
   * @param {String|Object|Array} moduleOpts
   * @param {Boolean} requireOnce
   */
  addModule(moduleOpts: moduleOpts, requireOnce: boolean = false) {
    let src
    let options
    let handler

    // Type 1: String
    if (typeof moduleOpts === 'string') {
      src = moduleOpts
    } else if (Array.isArray(moduleOpts)) {
      // Type 2: Babel style array
      src = moduleOpts[0]
      options = moduleOpts[1]
    } else if (typeof moduleOpts === 'object') {
      // Type 3: Pure object
      src = moduleOpts.src
      options = moduleOpts.options
      handler = moduleOpts.handler
    }

    // 解析处理程序 - 引入处理程序[必须是一个方法]
    if (!handler) {
      handler = this.etsx.resolver.requireModule(src)
    }

    // 验证处理程序
    /* istanbul ignore if */
    if (typeof handler !== 'function') {
      // 如果不是一个方法，就抛出异常
      throw new Error('Module should export a function: ' + src)
    }

    // 获取到一个模块的唯一key，如果方法的meta属性中没有name 就是要 src
    const key = (handler.meta && handler.meta.name) || handler.name || src

    // 更新 存储一次性加载的模块的对象
    if (typeof key === 'string') {
      // 如果对象中存在，就不再此引入
      if (requireOnce && this.requiredModules.get(key)) {
        return
      }
      // 存储起来，防止再次引入
      this.requiredModules.set(key, { src, options, handler })
    }

    // 如果 配置选项为 undefined，将使用 空对象 作为配置选项
    if (options === undefined) {
      options = {}
    }

    return new Promise((resolve, reject) => {
      // 使用`this`上下文调用模块并传递选项
      const result = handler.call(this, options)

      // 如果模块发回一个 承诺[Promise]
      if (result && result.then) {
        // 等待承诺的提交
        return resolve(resolve, reject)
      }

      // 提交实现了承诺
      return resolve()
    })
  }
  get options() {
    if (this.etsx && this.etsx.options) {
      return this.etsx.options
    } else {
      throw new Error('etsx.options error')
    }
  }
}
export default ModuleContainer
