import EtsxCommon from './common'
import { getOptions, defaultsDeepClone } from '@etsx/utils'

type css = string
type module = string
type plugin = string
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
  // 模块
  modules: module[];
  // 插件
  plugins: plugin[];
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
    this.react = defaultsDeepClone<this['react']>(options.react, {})
    this.css = Array.isArray(options.css) ? options.css as this['css'] : []
    this.modules = Array.isArray(options.modules) ? options.modules as this['modules'] : []
    this.plugins = Array.isArray(options.plugins) ? options.plugins as this['plugins'] : []
  }
}
export default EtsxApp
