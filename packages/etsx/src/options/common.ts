import capitalize from 'lodash/capitalize';
import { stdEnv as env, isNonEmptyString, hookable, Hookable, getOptions, defaultsDeepClone } from '@etsx/utils';
import { server } from '@etsx/server';

export const globalNameReg = /^[a-zA-Z]+$/

export type globalName = string
export type global = string | ((globalName: globalName) => string)
export type globals = {
  [K in 'id' | 'etsx' | 'context' | 'pluginPrefix' | 'readyCallback' | 'loadedCallback']: global
}

export type env = {
  [key: string]: string | undefined;
}

export type modulesDir = string

export type extension = string

export type hooks = null | ((hook: Hookable['hook']) => hookable.HookHandler[]) | { [key: string]: hookable.HookHandler }

export abstract class EtsxCommon {
  // 环境变量
  env: env;
  /**
   * 开发模式
   */
  dev: boolean;
  /**
   * 自动测试
   */
  test: boolean;
  /**
   * 调试模式
   */
  debug: boolean;
  /**
   * 全局名字
   */
  globalName: string;
  globals: globals;
  serverMiddleware: server.serverMiddleware[];
  /**
   * 服务器渲染判断现代浏览器: server | true
   * 客户端 <script type="module"> <script nomodule> 判断现代浏览器: client
   * 禁用 false
   */
  modern?: 'server' | 'client' | true | false;
  /**
   * 模块目录
   */
  modulesDir: modulesDir[];
  /**
   * 自动后缀支持扩展名
   */
  extensions: extension[];
  /**
   * 如果文件名以ignorePrefix指定的前缀开头，
   * 则在构建打包期间将忽略pages / layout / middleware /或store /中的任何文件
   */
  ignorePrefix: string;
  /**
   * 忽略
   */
  ignore: string[];
  /**
   * Editor
   */
  editor?: string;

  /**
   * Hooks - 自定义项目钩子
   */
  hooks?: hooks
  constructor(options: getOptions<EtsxCommon> = {}) {
    // 开发模式
    this.dev = typeof options.dev === 'undefined' ? Boolean(env.dev) : Boolean(options.dev)
    // 端对端测试模式
    this.test = typeof options.test === 'undefined' ? Boolean(env.test) : Boolean(options.test)
    // 调试模式 - undefined[void 0]等同于开发模式
    this.debug = typeof options.debug === 'undefined' ? this.dev : Boolean(options.debug)
    // 配置环境变量
    this.env = typeof options.env === 'undefined' ? process.env : options.env
    // 是否启用现代浏览器模块
    this.modern = typeof options.modern !== 'undefined' && ['server', 'client', true].includes(options.modern) ? options.modern : false
    // 全局名字
    this.globalName = (
      options.globalName &&
      isNonEmptyString(options.globalName) &&
      globalNameReg.test(options.globalName)
    ) ? options.globalName.toLowerCase() : `etsx`

    this.globals = defaultsDeepClone<this['globals']>(options.globals, {
      // 全局挂载点的id名字
      id: (globalName: globalName) => `__${globalName}`,
      // 项目对象的全局变量
      etsx: (globalName: globalName) => `$${globalName}`,
      // 上下文 - 初始化状态
      context: (globalName: globalName) => `__${globalName.toUpperCase()}__`,
      // 插件前缀
      pluginPrefix: (globalName: globalName) => globalName,
      // 挂着后的下一进程
      readyCallback: (globalName: globalName) => `on${capitalize(globalName)}Ready`,
      // 加载完毕的时候，如果全局中存在该方法就调用
      loadedCallback: (globalName: globalName) => `_on${capitalize(globalName)}Loaded`,
    })

    // 服务器中间件
    this.serverMiddleware = options.serverMiddleware || []
    // 模块目录
    this.modulesDir = (options.modulesDir as this['modulesDir']) || ['node_modules']
    // 自动后缀支持扩展名
    this.extensions = (options.extensions as this['extensions']) || []
    // 如果文件名以ignorePrefix指定的前缀开头，则在构建打包期间将忽略
    this.ignorePrefix = options.ignorePrefix || '-'
    // 忽略
    this.ignore = Array.isArray(options.ignore) ? (options.ignore as string[]) : [
      '**/*.test.*',
      '**/*.spec.*',
    ]
    this.editor = options.editor
    this.hooks = options.hooks as this['hooks'] || null
  }
}
export default EtsxCommon
