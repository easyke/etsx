
import http from 'http'
import http2 from 'http2'
import WebSocket from 'ws'
import { Listener, Request, Response, RequestListener, WebSocketListener, next, options as ListenOptions } from './listener'
import { deferRun, logger } from '@etsx/utils'

const parseUrl = require('parseurl')
const finalhandler = require('finalhandler')
const app = Symbol('app')
export type ApplicationOptions = {}
export type listen = (options: ListenOptions) => Listener
export type ErrorListener = (error: Error | any, req: Request | WebSocket, res: Response | Request, next: next) => void
export type useAppHandler = {
  path?: string;
  handler: ErrorListener | RequestListener | WebSocketListener | http.Server;
  method?: string;
  isWebSocket?: boolean;
};
export type useAppListener = ErrorListener | RequestListener | WebSocketListener | http.Server | useAppHandler
export type App = {
  (req: Request | WebSocket, res: Response | Request, next?: next): void;
  ws: (path: string | WebSocketListener, handle?: WebSocketListener) => Application;
  get: (path: string | RequestListener, handle?: RequestListener) => Application;
  put: (path: string | RequestListener, handle?: RequestListener) => Application;
  post: (path: string | RequestListener, handle?: RequestListener) => Application;
  delete: (path: string | RequestListener, handle?: RequestListener) => Application;
  use: (path: string | useAppListener, handle?: useAppListener, method?: string, isWebSocket?: boolean) => Application;
  listen: listen;
}
export type method = 'get' | 'post' | 'put' | 'delete' | string;
export type context = {
  ws?: WebSocket;
  req?: Request;
  res?: Response;
  next?: next;
  onError?: (e: Error | any) => void;
}
export type layer = {
  path: string;
  handle: RequestListener | WebSocketListener | ErrorListener;
  method: method;
  isWebSocket: boolean;
}

export class Application {
  [app]?: App;
  stack: layer[];
  constructor(options?: ApplicationOptions) {
    this.stack = []
  }
  handle(reqOrWs: Request | WebSocket, resOrReq: Response | Request, next?: next): void {
    // 获取上下文
    const context = parseArgs(arguments)
    // 或许协议+主机名
    const protohost = (context.req && getProtocolHost(context.req.url)) || ''
    if (context.req) {
      // 存储原始URL
      (context.req as any).originalUrl = (context.req as any).originalUrl || context.req.url;
    }
    // 开始运行中间件栈
    this.runStack(context, protohost)
  }
  runStack(context: context, protohost = '', error = null, index = 0, removed = '', slashAdded = false): false | void {
    if (!context || !context.req) {
      return
    }
    const { req, res } = context
    const isWebSocket = context.ws instanceof WebSocket
    const next = () => nextIndex === ++index && this.runStack(context, protohost, error, index, removed, slashAdded)
    const nextIndex = index + 1
    if (!req.url) {
      req.url = ''
    }
    if (slashAdded && req.url) {
      req.url = req.url.substr(1);
      slashAdded = false;
    }
    if (removed.length !== 0) {
      req.url = protohost + removed + req.url.substr(protohost.length)
      removed = ''
    }
    // 路由数据
    const path = parseUrl(req).pathname || '/'

    // 从中间件 栈中取第几栈
    const layer = this.stack[index]

    // 全部中间件都完成了，所以调用完成退出
    if (layer) {
      // 如果请求是 webSocket 但是该中间件，不是一个 webSocket 中间件，所以需要跳过本中间件
      // 如果中间件 是一个 webSocket 中间件，不适合 http请求，所以需要跳过本中间件
      if (isWebSocket !== layer.isWebSocket) {
        // 下一步
        return next()
      }
    } else {
      /**
       * 既然没有找到中间件栈了
       * 延迟执行 最终函数处理程序
       */
      return deferRun(() => {
        if (context.next) {
          context.next()
        } else if (isWebSocket) {
          this.logerror('长链接连接')
        } else {
          // 最终函数处理程序
          (finalhandler(req, res, {
            env: process.env.NODE_ENV || 'development',
            onerror: context.onError || this.logerror,
          }))()
        }
      })
    }

    const route = layer.path

    // 如果路由的path前缀不匹配，则跳过此中间件
    if (path.toLowerCase().substr(0, route.length) !== route.toLowerCase()) {
      // 错误传递到下一个
      return next()
    }

    // 如果路由匹配没有边界'/'、'.'或 已经结束，则跳过
    const c = path.length > route.length && path[route.length];
    if (c && c !== '/' && c !== '.') {
      return next()
    }

    // trim off the part of the url that matches the route
    if (route.length !== 0 && route !== '/') {
      removed = route;
      req.url = protohost + req.url.substr(protohost.length + removed.length);

      // 假如没有带协议的host，保证地址是斜杆开头
      if (!protohost && req.url[0] !== '/') {
        req.url = '/' + req.url;
        slashAdded = true;
      }
    }
    const arity = layer.handle.length
    const hasError = Boolean(error)

    try {
      // 存在错误并方法是接收4个参数
      if (hasError && arity === 4) {
        // error-handling middleware
        if (context.ws) {
          (layer.handle as ErrorListener).call(context, error, context.ws, req, next)
        } else {
          (layer.handle as ErrorListener).call(context, error, req, (context.res as Response), next)
        }
        return
      } else if (!hasError && arity < 4) {
        // request-handling middleware
        if (context.ws) {
          (layer.handle as WebSocketListener)(context.ws, req, next)
        } else {
          (layer.handle as RequestListener)(req, (context.res as Response), next)
        }
        return
      }
    } catch (e) {
      // replace the error
      error = e;
    }
    // 继续
    return next()
  }
  logerror(err: any): void {
    if (err) {
      logger.error(err)
    }
  }
  ws(path: string | WebSocketListener, handle?: WebSocketListener): this {
    return this.use(path, handle, 'get', true)
  }
  get(path: string | RequestListener, handle?: RequestListener): this {
    return this.use(path, handle, 'get')
  }
  post(path: string | RequestListener, handle?: RequestListener): this {
    return this.use(path, handle, 'post')
  }
  put(path: string | RequestListener, handle?: RequestListener): this {
    return this.use(path, handle, 'put')
  }
  delete(path: string | RequestListener, handle?: RequestListener): this {
    return this.use(path, handle, 'delete')
  }
  use(path: string | useAppListener, handle?: useAppListener, method: string = 'all', isWebSocket: boolean = false): this {
    // 如果地址不是一个字符串,path 可能为 handle
    if (!handle && typeof path !== 'string') {
      handle = path
      path = ''
    }
    if (typeof handle === 'object') {
      if (handle instanceof http.Server) {
        // 取得1.0的监听器
        if (handle.listeners('request')) {
          handle = (handle.listeners('request')[0] as RequestListener)
        }
      } else if (typeof handle.handler === 'function') {
        // 包装子应用程序
        if (handle.path) {
          path = handle.path
        }
        if (handle.isWebSocket) {
          isWebSocket = handle.isWebSocket
        }
        if (handle.method) {
          path = handle.method
        }
        handle = handle.handler.bind(handle)
      }
    }
    // 删除最后一个斜杆
    if (typeof path === 'string' && path[path.length - 1] === '/') {
      path = path.slice(0, -1)
    }
    if (handle && typeof handle === 'function') {
      // 添加 这一层 中间件 加入 栈
      this.stack.push({
        // path 默认为 '/'
        path: (path as string) || '/',
        handle,
        method,
        isWebSocket,
      })
      return this
    } else {
      throw new Error('没有找到监听器');

    }
  }
  listen(options: ListenOptions): Listener {
    return new Listener(
      options,
      this.app,
      this.app,
    )
  }
  get app(): App {
    if (!this[app]) {
      this[app] = Object.assign(this.handle.bind(this), {
        use: this.use.bind(this),
        ws: this.ws.bind(this),
        get: this.get.bind(this),
        put: this.put.bind(this),
        post: this.post.bind(this),
        delete: this.delete.bind(this),
        listen: this.listen.bind(this),
      })
    }
    return (this[app] as App)
  }
}
export function createApp(options?: ApplicationOptions): App {
  return (new Application(options)).app
}
export function parseArgs(_: any): context {
  const context: context = Object.create(null)
  const args: any[] = Array.prototype.concat(Array.prototype.slice.call(arguments as IArguments))

  if (Array.isArray(args)) {
    for (let i = args.length - 1; i >= 0; i--) {
      // function
      if (typeof args[i] === 'function') {
        if (!context.next) {
          context.next = args[i]
        } else if (!context.onError) {
          context.onError = args[i]
        } else {
          continue
        }
      } else if (args[i] instanceof http.IncomingMessage) {
        // http1.x - request
        context.req = args[i]
      } else if (args[i] instanceof http.ServerResponse) {
        // http1.x - response
        context.res = args[i]
      } else if (args[i] instanceof http2.Http2ServerRequest) {
        // http2.x - request
        context.req = args[i]
      } else if (args[i] instanceof http2.Http2ServerResponse) {
        // http2.x - response
        context.res = args[i]
      } else if (args[i] instanceof WebSocket) {
        // ws - WebSocket
        context.ws = args[i]
      }
    }
  }
  return context
}

/**
 * 通过URL来获取 protocol 和 host 部分
 *
 * @param {string} url
 * @private
 */

function getProtocolHost(url?: string): string | undefined {
  if (!url || url.length === 0 || url[0] === '/') {
    return undefined;
  }

  const searchIndex = url.indexOf('?');
  // 获取path的长度，如果 不存在 search，path长度就是url的长度
  const pathLength = searchIndex !== -1 ? searchIndex : url.length;
  const fqdnIndex = url.substr(0, pathLength).indexOf('://');

  return fqdnIndex !== -1 ? url.substr(0, url.indexOf('/', 3 + fqdnIndex)) : undefined;
}
