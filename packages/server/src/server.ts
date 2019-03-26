import http from 'http'
import path from 'path'
import { Etsx, EtsxModule } from 'etsx'
import { createApp, application } from '@etsx/listener'
import { logger, isUrl, determineGlobals } from '@etsx/utils'
import { renderAndGetWindow, jsdomOpts } from './jsdom'
import etsxMiddleware from './middleware/etsx'
import errorMiddleware from './middleware/error'
import modernMiddleware from './middleware/modern'
import Renderer from './renderer';
import serveStatic from 'serve-static';

const servePlaceholder = require('serve-placeholder')
const launchMiddleware = require('launch-editor-middleware')

const devMiddleware = Symbol('devMiddleware')
const hotMiddleware = Symbol('hotMiddleware')
export type serverEtsxMiddleware = application.useAppHandler & { prefix?: boolean; };
export type serverMiddleware = string | application.useAppListener | serverEtsxMiddleware;
type MiddlewarePromise = {
  (req: any, res: any): Promise<void>;
  close?: () => Promise<void>;
}
type MiddlewareMap = Map<string, MiddlewarePromise>;
export class Server extends EtsxModule {
  globals: { [key: string]: string };
  app: application.App;
  renderer?: Renderer;
  [devMiddleware]?: MiddlewareMap;
  [hotMiddleware]?: MiddlewareMap;
  /**
   * 构造函数
   * @param {Object} etsx
   */
  constructor(etsx: Etsx) {
    super(etsx)

    this.globals = determineGlobals(this.options.globalName, this.options.globals)

    // Runtime shared resources
    // 运行时共享资源
    this.resources = {}

    // 创建新的连接实例
    this.app = createApp()
  }
  /**
   * 准备就绪
   */
  async ready() {
    // 调用渲染前的钩子
    await this.etsx.callHook('render:before', this, this.options.render)

    // 初始化渲染器
    this.renderer = new Renderer(this)
    await this.renderer.ready()

    // 设置project中间件
    await this.setupMiddleware()

    // 调用渲染完成的钩子
    await this.etsx.callHook('render:done', this)

  }

  async setupMiddleware() {
    // 调用项目钩子中的中间件绑定
    await this.etsx.callHook('render:setupMiddleware', this.app)

    // 用于生产的压缩中间件
    if (!this.options.dev) {
      const compressor = this.options.render.compressor
      if (typeof compressor === 'object') {
        // If only setting for `compression` are provided, require the module and insert
        const compression = this.etsx.resolver.requireModule('compression')
        this.useMiddleware(compression(compressor) as any)
      } else {
        // Else, require own compression middleware
        this.useMiddleware(compressor as any)
      }
    }

    // 如果现代浏览器判断是在服务器中实现
    if (this.options.modern === 'server') {
      // 使用该中间件
      this.useMiddleware(modernMiddleware)
    }

    // 使用 web 静态文件中间件
    this.useMiddleware({
      prefix: this.options.render.staticPrefix,
      handler: serveStatic(
        this.options.dir.web.static,
        this.options.render.static,
      ) as any,
    })
    // 使用 wap 静态文件中间件
    this.useMiddleware({
      prefix: this.options.render.staticPrefix,
      handler: serveStatic(
        this.options.dir.wap.static,
        this.options.render.static,
      ) as any,
    })

    // 仅为开发模式添加webpack中间件支持
    if (this.options.dev) {
      this.useMiddleware(async (req: any, res: any, next: (...args: any[]) => void) => {
        // 识别古代浏览器还是现代浏览器
        const name = req.modernMode ? 'modern' : 'client'
        // 浏览器的dev文件中间件
        if (this.devMiddleware.has(name)) {
          await (this.devMiddleware.get(name) as MiddlewarePromise)(req, res)
        }
        if (this.devMiddleware.has('weex')) {
          await (this.devMiddleware.get('weex') as MiddlewarePromise)(req, res)
        }
        // 浏览器的热渲染中间件
        if (this.hotMiddleware.has(name)) {
          await (this.hotMiddleware.get(name) as MiddlewarePromise)(req, res)
        }
        // 下一进程
        next()
      })
      this.useMiddleware(async (ws: any, req: any, next: (...args: any[]) => void) => {
        // weex打包专用
        if (this.hotMiddleware.has('weex')) {
          await (this.hotMiddleware.get('weex') as MiddlewarePromise)(ws, req)
        }
        // 下一进程
        next()
      }, true)
    } else {
      // Serve .etsx/dist/client files only for production
      // 对于开发模式，他们将使用[this.devMiddleware]webpack中间件
      const distDir = path.resolve(this.options.dir.build, 'dist', 'client')
      this.useMiddleware({
        path: this.options._publicPath || this.options.publicPath,
        handler: serveStatic(
          distDir,
          this.options.render.dist,
        ) as any,
      })
    }

    // 仅在调试模式的编辑器中打开
    if (this.options.debug && this.options.dev) {
      this.useMiddleware({
        path: '__open-in-editor',
        handler: launchMiddleware(this.options.editor),
      })
    }

    // 添加 配置选项 用户提供的中间件
    this.options.serverMiddleware.forEach((m) => {
      this.useMiddleware(m)
    })

    const { fallback } = this.options.render
    if (fallback) {
      // 没有找到文件，试图在
      if (fallback.dist) {
        this.useMiddleware({
          path: this.options._publicPath || this.options.publicPath,
          handler: servePlaceholder(fallback.dist),
        })
      }

      // Graceful 404 errors for other paths
      if (fallback.static) {
        this.useMiddleware({
          path: '/',
          handler: servePlaceholder(fallback.static),
        })
      }
    }

    // 最后使用项目中间件
    this.useMiddleware(etsxMiddleware({
      options: this.options,
      project: this.etsx,
      renderRoute: this.renderRoute.bind(this),
      resources: this.resources,
    }))

    /**
     * 存在“错误处理”中间件的特殊情况。
     * 中间件中的函数只有4个参数。
     * 当中间件将错误传递给下一个时，
     * 应用程序将继续查找在该中间件之后声明的错误中间件并调用它，
     * 跳过该中间件和任何非错误中间件之上的任何错误中间件。
     *
     * 注意：错误中间件必须使用四个参数
     *
     * @see: https://github.com/senchalabs/connect#error-middleware
     */

    // 首先使用 项目模块[modules] 应用的 错误中间件[errorMiddleware]
    await this.etsx.callHook('render:errorMiddleware', this.app)

    // 使用项目应用的 错误中间件[errorMiddleware]
    this.useMiddleware(errorMiddleware({
      resources: this.resources,
      options: this.options,
    }))
  }
  /**
   * 使用中间件
   * @param {String|Function|Object} middleware
   */
  useMiddleware(
    middleware: serverMiddleware,
    isWebSocket: boolean = false,
    method: application.method = 'all',
  ) {
    let path: string = ''
    let handler: application.useAppListener
    try {
      if (typeof middleware === 'string') {
        handler = this.etsx.resolver.requireModule(middleware)
      } else if (typeof middleware === 'object') {
        if (middleware instanceof http.Server) {
          // 取得1.0的监听器
          if (middleware.listeners('request')) {
            handler = (middleware.listeners('request')[0] as application.useAppListener)
          } else {
            throw new Error('not find request');
          }
        } else if (typeof middleware.handler === 'string') {
          handler = this.etsx.resolver.requireModule(middleware.handler)
        } else {
          path = (
            (middleware as serverEtsxMiddleware).prefix !== false ?
              this.options.router.base : ''
          ) + (
              typeof middleware.path === 'string' ? middleware.path : ''
            )
          handler = middleware.handler
          method = middleware.method || method
          isWebSocket = middleware.isWebSocket || isWebSocket
        }
      } else {
        handler = middleware
      }
      // 使用中间件
      this.app.use(path, handler, method, isWebSocket)
    } catch (err) {
      logger.error(err)
      // Throw error in production mode
      if (!this.options.dev) {
        throw err
      }
    }
  }
  /**
   * 渲染路由
   * @param {String} url 带渲染的路由路径
   * @param {Object} context 指定的上下文对象，可用的属性键： req 和 res
   * @return {Promise}
   * {
   *   html: String,
   *   error: null|Object,
   *   redirected: false|Object
   * }
   */
  renderRoute() {
    return this.renderer.renderRoute.apply(this.renderer, arguments)
  }
  /**
   * 加载资源
   * @param {*} fs
   */
  loadResources() {
    return this.renderer.loadResources.apply(this.renderer, arguments)
  }
  /**
   * 渲染指定url并获取对应的window对象。
   * @param {*} url
   * @param {*} opts
   */
  renderAndGetWindow(url: string, opts: jsdomOpts = {}) {
    return renderAndGetWindow(url, opts, {
      loadedCallback: this.globals.loadedCallback,
      globals: this.globals,
    })
  }
  get devMiddleware() {
    if (!this[devMiddleware]) {
      this[devMiddleware] = new Map()
    }
    return this[devMiddleware] as MiddlewareMap
  }
  set devMiddleware(value: MiddlewareMap) {
    if (value) {
      this[devMiddleware] = value
    } else {
      this.devMiddleware.clear()
    }
  }
  get hotMiddleware() {
    if (!this[hotMiddleware]) {
      this[hotMiddleware] = new Map()
    }
    return this[hotMiddleware] as MiddlewareMap
  }
  set hotMiddleware(value: MiddlewareMap) {
    if (value) {
      this[hotMiddleware] = value
    } else {
      this.hotMiddleware.clear()
    }
  }
}
export default Server
