import EtsxCommon from './common'
import { getOptions, defaultsDeepClone } from '@etsx/utils'
import { moduleContainer } from 'etsx'

type css = string
export abstract class EtsxApp extends EtsxCommon {
  // vue 配置
  vue: {
    config: {
      silent?: boolean; // = !dev
      performance?: boolean; // = dev
    };
  };
  // react 配置
  react: {
  };
  /**
   * etsx-app 浏览器模板，一般和weex的模板一致
   * 默认: @etsx/browser-weex-app
   */
  template?: string;
  // 模板
  templates: moduleContainer.dstemplate[];
  // 模块
  modules: moduleContainer.module[];
  // 插件
  plugins: moduleContainer.plugin[];
  // 错误页
  ErrorPage: null | string;
  //
  layouts: {
    [key: string]: string;
  };
  // 样式
  css: css[];
  constructor(options: getOptions<EtsxApp> = {}) {
    super(options);
    this.vue = defaultsDeepClone<this['vue']>(options.vue, {
      config: {
        silent: !this.dev,
        performance: this.dev,
      },
    })
    this.ErrorPage = options.ErrorPage || null
    this.react = defaultsDeepClone<this['react']>(options.react, {})
    this.css = Array.isArray(options.css) ? options.css as this['css'] : []
    this.modules = Array.isArray(options.modules) ? options.modules : []
    this.plugins = Array.isArray(options.plugins) ? options.plugins : []
    this.templates = Array.isArray(options.templates) ? options.templates : []
    this.layouts = Object.assign({}, options.layouts as this['layouts'])
  }
}
export default EtsxApp
