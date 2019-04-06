import EtsxCommon from './common'
import { getOptions, defaultsDeepClone } from '@etsx/utils'
import { moduleContainer } from 'etsx'

type css = string
export type framework = {
  initial: () => Promise<void>;
  renderToString: (App: any, props: any) => string;
  /**
   * 客户端执行，所有使用代码模板
   */
  getComponent: string;
  createElement: string;
  /**
   * 客户端执行，所有使用代码模板
   */
  renderToDom: string;
  aysncModules: string[];
};
export type frameworks = { [name: string]: framework };

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
  frameworks: frameworks;
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
    this.frameworks = options.frameworks as frameworks || {}
    Object.keys(frameworksDefaults).filter((key) => !this.frameworks[key]).forEach((key) => {
      this.frameworks[key] = frameworksDefaults[key]
    })
    module.paths.unshift('/Users/hua/Documents/Project/cdn/sic-ude/node_modules')
  }
}
export default EtsxApp

let anujs: any
let raxjs: any
let anujsReactDOMServer: any
let raxjsServerRenderer: any

const frameworksDefaults: frameworks = {
  anujs: {
    aysncModules: ['anujs'],
    initial: () => {
      if (!anujs) {
        anujs = require('anujs')
      }
      if (!anujsReactDOMServer) {
        anujsReactDOMServer = require('anujs/dist/React/server')
      }
      return Promise.resolve()
    },
    renderToString: (App: any, props: any): string => anujsReactDOMServer.renderToString(anujs.createElement(App, props)),
    getComponent: `() => importModule('anujs').then((res)=>res.Component)`,
    createElement: `() => importModule('anujs').then((res)=>res.createElement)`,
    renderToDom: `(App, props, dom) => importModule('anujs').then(({ createElement, render }) => render(createElement(App, props), dom))`,
  },
  raxjs: {
    aysncModules: ['rax', 'driver-dom'],
    initial: () => {
      if (!raxjs) {
        raxjs = require('rax')
      }
      if (!raxjsServerRenderer) {
        raxjsServerRenderer = require('rax-server-renderer')
      }
      return Promise.resolve()
    },
    renderToString: (App: any, props: any): string => raxjsServerRenderer.renderToString(raxjs.createElement(App, props)),
    getComponent: `() => importModule('rax').then((res)=>res.Component)`,
    createElement: `() => importModule('rax').then((res)=>res.createElement)`,
    renderToDom: `(App, props, dom) => Promise.all([importModule('rax'), importModule('driver-dom')]).then(([{ createElement, render }, driver]) => render(createElement(App, props), dom, { driver }))`,
  },
}
