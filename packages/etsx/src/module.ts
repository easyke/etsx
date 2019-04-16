
import fs from 'fs';
import path from 'path';
import Etsx from 'etsx';
import { logger, chainFn, sequence } from '@etsx/utils';
import { server } from '@etsx/server';
import EtsxModule from './base-module';
import { TemplateOptions } from 'lodash'

const hash: (src: any) => string = require('hash-sum')

export type dst = string

export type dstemplate = {
  src: string,
  dst: dst,
  options: object,
}

export type moduleOpts = {}
export type moduleObject = {
  src: string;
  options?: moduleOpts;
  handler: {
    (...args: any[]): any;
    meta: {
      name: string;
    };
  };
}
export type pluginObject = {
  /**
   * src 可以传入js文件路径，
   * 然后，每个端可以独立js
   * 如果 ssr、web、wap、ios、android 其中一个值为 false，
   * 该终端将不引入的插件，不会被打包，也不会占用任何打包空间，默认为true
   */
  name?: string;
  src: string;
  ssr?: boolean;
  web?: boolean;
  wap?: boolean;
  ios?: boolean;
  android?: boolean;
}
export type templateObject = {
  /**
   * 文件的路径
   */
  src: string;
  /**
   * 文件名称
   */
  fileName?: string;
  /**
   * lodash.template
   */
  options?: TemplateOptions;
}

export type module = string | moduleObject
export type plugin = string | pluginObject
export type template = string | templateObject

export class ModuleContainer extends EtsxModule {
  requiredModules: Map<string, moduleObject>;
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

    this.options.templates.push(templateObj)
    return templateObj
  }
  /**
   * 添加插件
   * @param template
   */
  addPlugin(template: templateObject & pluginObject) {
    const { dst } = this.addTemplate(template)
    // Add to etsx plugins
    this.options.plugins.unshift({
      src: path.join(this.options.dir.build, dst),
      ssr: typeof template.ssr === 'undefined' ? true : template.ssr,
      web: typeof template.web === 'undefined' ? true : template.web,
      wap: typeof template.wap === 'undefined' ? true : template.wap,
      ios: typeof template.ios === 'undefined' ? true : template.ios,
      android: typeof template.android === 'undefined' ? true : template.android,
    })
  }

  addLayout(template: template, name?: string) {
    const { dst, src } = this.addTemplate(template)
    const layoutName = name || path.parse(src).name
    const layout = this.options.layouts[layoutName]

    if (layout) {
      logger.warn(`Duplicate layout registration, "${layoutName}" has been registered as "${layout}"`)
    }

    // Add to nuxt layouts
    this.options.layouts[layoutName] = `./${dst}`

    // If error layout, set ErrorPage
    if (name === 'error') {
      this.addErrorLayout(dst)
    }
  }

  addErrorLayout(dst: dst) {
    this.options.ErrorPage = `~/${path.relative(this.options.dir.build, dst)}`
  }

  /**
   * 添加中间件
   * @param {Function} middleware
   */
  addServerMiddleware(middleware: server.serverMiddleware) {
    this.options.serverMiddleware.push(middleware)
  }
  extendBuild(fn: (...args: any[]) => any) {
    (this.options as any).build.extend = chainFn((this.options as any).build.extend, fn)
  }

  extendRoutes(fn) {
    this.options.router.extendRoutes = chainFn(
      this.options.router.extendRoutes,
      fn,
    )
  }
  /**
   * 一次性引入模块
   */
  requireModule(input: module | string | [string, moduleOpts]) {
    return this.addModule(input, true /* require once */)
  }

  /**
   * 添加模块
   * @param moduleOpts 参数
   * @param requireOnce 一次性引入模块
   */
  async addModule(moduleOpts: module | [string, moduleOpts], requireOnce: boolean = false): Promise<void> {
    let src: string = ''
    let options: moduleOpts | undefined = {}
    let handler: moduleObject['handler'] | undefined = void 0

    // Type 1: String
    if (typeof moduleOpts === 'string') {
      src = moduleOpts
    } else if (typeof moduleOpts === 'function') {
      // Define handler if moduleOpts is a function
      handler = moduleOpts
    } else if (Array.isArray(moduleOpts)) {
      // Type 2: Babel style array
      [src, options] = moduleOpts
    } else if (typeof moduleOpts === 'object') {
      // Type 3: Pure object
      ({ src, options, handler } = moduleOpts)
    }

    // 解析处理程序 - 引入处理程序[必须是一个方法]
    if (!handler && src) {
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
    if (options === void 0) {
      options = {}
    }
    // 使用`this`上下文调用模块并传递选项
    return await handler.call(this, options)
  }
}
export default ModuleContainer
