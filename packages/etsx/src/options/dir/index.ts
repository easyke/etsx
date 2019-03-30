import path from 'path'
import dist from './dist'
import weex from './weex'
import { web, wap } from './browser'
import { guardDir, getOptions, isNonEmptyString } from '@etsx/utils'
export class Dir {
  /**
   * 根目录
   */
  root: string;
  /**
   * 项目目录
   * 如果为undefined[void 0]，将自动跟随 root
   */
  src: string;
  /**
   * 编译目录
   */
  build: string;
  /**
   * 模块文件夹 - node_modules
   */
  modules: string[];
  /**
   * 导出目录
   */
  dist: dist;
  /**
   * web配置
   */
  web: web;
  /**
   * wap配置
   */
  wap: wap;
  /**
   * weex小程序
   */
  weex: weex;
  /**
   * 小程序配置
   */
  miniProgram: miniProgram;
  // 构造函数
  constructor(options: getOptions<Dir>) {
    if (!options) {
      options = {}
    }
    // 检查srcDir是否存在
    const hasSrcDir = options.src && isNonEmptyString(options.src)
    // 解析根目录
    this.root = options.root && isNonEmptyString(options.root) ? path.resolve(options.root) : process.cwd()
    // 解析代码目录，否则和根目录保持一致
    this.src = hasSrcDir && options.src ? path.resolve(this.root, options.src) : this.root
    // 默认编译目录
    this.build = path.resolve(this.root, options.build && isNonEmptyString(options.build) ? options.build : '.etsx')
    // 保护 root目录 免受 build 目录 的攻击
    guardDir(this, 'root', 'build')

    /*if (hasGenerateDir) {
      // Resolve generate.dir
      this.generate.dir = path.resolve(this.root, options.generate)

      // Protect rootDir against buildDir
      guardDir(this, 'root', 'generate')
    }*/
    this.modules = options.modules ? (Array.isArray(options.modules) ? options.modules as this['modules'] : [options.modules]) : [
      'node_modules',
    ]
    this.dist = dist(options.dist || {}, this.root)
    /**
     * web配置
     */
    this.web = web(options.web || {}, this.src)
    /**
     * wap配置
     */
    this.wap = wap(options.wap || {}, this.src)
    /**
     * weex小程序
     */
    this.weex = weex(options.weex || {}, this.root)
  }
}
export default Dir
