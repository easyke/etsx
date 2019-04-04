import net from 'net'
import tls from 'tls'
import http from 'http'
import https from 'https'
import http2 from 'http2'
import EventEmitter from 'events'
import WebSocket from 'ws'

export const httpServer = Symbol('httpServer')
export const httpsServer = Symbol('httpsServer')
export const http2Server = Symbol('http2Server')
export const webSocketServer = Symbol('WebSocketServer')

export const contexts = Symbol('contexts')
export const socketPools = Symbol('socketPools')
export const listenPools = Symbol('listenPools')

export type Request = http.IncomingMessage | http2.Http2ServerRequest
export type Response = http.ServerResponse | http2.Http2ServerResponse
export type Socket = net.Socket | tls.TLSSocket
export type listen = {
  path?: string,
  port?: number | string,
  host?: number | string,
}
export type listenType = 'tcp' | 'ssl' | 'tls';
export type options = {
  http?: boolean;
  https?: https.ServerOptions | ((listener: Listener) => https.ServerOptions);
  http2?: http2.SecureServerOptions | ((listener: Listener) => http2.SecureServerOptions);
  listen: ListenOptions | listen;
};
export type ListenOptions = {
  type?: listenType;
  hostname?: listen['host'];
} & listen

export type next = (err?: any) => void;
export type FListenOptions = (listener: Listener) => number | string | ListenOptions | undefined;
export type RequestListener = (req: Request, res: Response, next: next) => void;
export type WebSocketListener = (ws: WebSocket, req: Request, next: next) => void;

export type MiddlewareListener = RequestListener | WebSocketListener;

export type httpServer = http.Server
export type httpsServer = https.Server
export type http2Server = http2.Http2SecureServer
export type WebSocketServer = WebSocket.Server
export type SNICallback = tls.TlsOptions['SNICallback']

export interface IListenServer extends net.Server {
  $easyke$type: listenType,
  $easyke$listen: listen
}

export class Listener extends EventEmitter {
  [contexts]?: Map<string, tls.SecureContext>;
  [listenPools]?: Map<string, IListenServer>;
  [socketPools]?: Map<string, Socket>;
  [httpServer]?: httpServer = void 0;
  [httpsServer]?: httpsServer = void 0;
  [http2Server]?: http2Server = void 0;
  [webSocketServer]?: WebSocketServer = void 0;
  SNICallback?: SNICallback;
  constructor(options?: options | RequestListener, onRequest?: RequestListener | WebSocketListener, onWsConnection?: WebSocketListener) {
    super()
    if (typeof options === 'function' && onRequest === void 0 && onWsConnection === void 0) {
      onRequest = (options as RequestListener)
      options = Object.create(null) as options
    } else if (typeof options === 'function' && typeof onRequest === 'function' && onWsConnection === void 0) {
      onWsConnection = (onRequest as WebSocketListener)
      onRequest = (options as RequestListener)
      options = Object.create(null) as options
    }
    if (typeof onRequest === 'function') {
      this.on('request', onRequest)
    }
    if (typeof onWsConnection === 'function') {
      this.on('webSocket', onWsConnection)
    }
    this.initialize(options as options)
  }
  initialize(options: options) {
    const onError = (...args: any) => this.emit('error', ...args)
    const onRequest = (...args: any) => this.emit('request', ...args)
    const onUpgrade = (req: http.IncomingMessage, socket: Socket, head: Buffer) => {
      if (this.webSocketServer) {
        this.webSocketServer.handleUpgrade(req, socket, head, (ws: WebSocket) => this.emit('webSocket', ws, req))
      }
    }
    const SNICallback: SNICallback = (servername: string, cb: (err: Error | null, ctx: tls.SecureContext) => void) => {
      if (typeof this.SNICallback === 'function') {
        this.SNICallback(servername, cb)
      } else {
        const context = this.contexts.get(servername)
        if (context) {
          cb(null, context)
        } else {
          cb(new Error('No certificate'), { context: null })
        }
      }

    };
    this[webSocketServer] = new WebSocket.Server({ noServer: true });
    if (options.http !== false) {
      // 初始化http服务
      this[httpServer] = http
        .createServer()
        .on('upgrade', onUpgrade)
        .on('error', onError)
        .on('request', onRequest)
    }
    if (options.http2 !== false) {
      // 初始化http2服务
      const http2Options: http2.SecureServerOptions = Object.create(null)
      if (typeof options.http2 === 'function') {
        Object.assign(http2Options, options.http2(this))
      } else if (typeof options.http2 === 'object') {
        Object.assign(http2Options, options.http2)
      }
      http2Options.SNICallback = SNICallback
      if (typeof http2Options.allowHTTP1 === typeof void 0) {
        http2Options.allowHTTP1 = true
      }
      this[http2Server] = http2
        .createSecureServer(http2Options)
        .on('upgrade', onUpgrade)
        .on('error', onError)
        .on('request', onRequest)
    } else if (options.https !== false) {
      // 如果没有初始化http2服务，然而没有拒绝初始化了https服务
      const httpsOptions: https.ServerOptions = Object.create(null)
      if (typeof options.https === 'function') {
        Object.assign(httpsOptions, options.https(this))
      } else if (typeof options.https === 'object') {
        Object.assign(httpsOptions, options.https)
      }
      httpsOptions.SNICallback = SNICallback
      this[httpsServer] = https
        .createServer(httpsOptions)
        .on('upgrade', onUpgrade)
        .on('error', onError)
        .on('request', onRequest)
    }

    if (options && options.listen) {
      this.listen(options.listen)
    }
  }
  /**
   * 会强制回收 所有链接会话
   */
  destroy() {
    // 关闭监听
    return this.close(true)
  }
  /**
   * 关闭监听，不会影响已经建立链接的会话
   */
  async close(isGraceful = false) {
    this[httpServer] = void 0
    this[httpsServer] = void 0
    this[http2Server] = void 0
    this[webSocketServer] = void 0

    this.clearContext()
    // 解除监听
    await this.unListen()
    // 如果存在 长连接池
    if (isGraceful === true) {
      // 遍历销毁
      this.socketPools.forEach((socket: Socket) => (socket.destroy && socket.destroy()))
      // 清除长连接池
      this.socketPools.clear()
    }
  }
  /**
   * 解除监听
   *
   * @param      {<type>}   options  The options
   * @return     {Promise}  { description_of_the_return_value }
   */
  unListen(options?: string | ListenOptions | listen) {
    const ids: string[] = []
    if (typeof options === typeof void 0) {
      Array.prototype.push.apply(ids, Array.from(this.listenPools.keys()))
    } else if (typeof options === 'string') {
      // id
      ids.push(options)
    } else if (typeof options === 'object') {
      if (Array.isArray(options)) {
        // 并列执行监听承诺
        return Promise.all(options.map((option: ListenOptions | listen) => this.listen(option)))
      } else {
        // {类型, 监听}
        const { listen } = listenOptionsFormat(this, options)
        // id
        ids.push(JSON.stringify(listen))
      }
    }
    return Promise.all(ids.map((id) => {
      const server = this.listenPools.get(id)
      if (server && server.close) {
        server.close()
        this.listenPools.delete(id)
      }
    }))
  }
  /**
   * 监听
   *
   * @param      {Function}  options  The options
   * @return     {Promise}   { description_of_the_return_value }
   */
  async listen(options: ListenOptions | listen): Promise<void> {
    if (Array.isArray(options)) {
      // 并列执行监听承诺
      return Promise.all(options.map((option) => this.listen(option))).then(() => { })
    }
    const connectionListener = createConnectionListener(this)
    // {类型, 监听}
    const { type, listen } = listenOptionsFormat(this, options)
    // id
    const id = JSON.stringify(listen)
    // 试图获取监听对象
    if (this.listenPools.get(id)) {
      await this.unListen(id)
    }
    // 创建 tcp 网络服务
    const server = net.createServer() as IListenServer
    // 协议类型
    server.$easyke$type = type
    // 监听
    server.$easyke$listen = listen
    // 监听 网络端口
    await new Promise((resolve, reject) => {
      const onError = (e: Error | any) => {
        if (reject) {
          server.off('error', onError)
          server.off('listening', onListening)
          reject(e)
          resolve = reject = () => { }
        }
      }
      const onListening = () => {
        if (resolve) {
          server.off('error', onError)
          server.off('listening', onListening)
          resolve()
          resolve = reject = () => { }
        }
      }
      // 一次性监听错误
      server.once('error', onError)
      // 一次性绑定监听
      server.once('listening', onListening)
      // 开始监听
      server.listen(server.$easyke$listen)
    })
    // 加入监听池
    this.listenPools.set(id, server)
    // 绑定 监听链接建立事件
    server.on('connection', connectionListener)
    // 解除事件
    server.once('close', () => this.off('connection', connectionListener))
  }
  clearContext() {
    this.contexts.clear()
  }
  addContext(hostname: string, context: tls.SecureContext | tls.SecureContextOptions) {
    if (context instanceof tls.SecureContext) {
      this.contexts.set(hostname, context as tls.SecureContext)
    } else {
      this.addContext(hostname, tls.createSecureContext(context as tls.SecureContextOptions))
    }
  }
  get contexts(): Map<string, tls.SecureContext> {
    if (!this[contexts]) {
      this[contexts] = new Map()
    }
    return (this[contexts] as Map<string, tls.SecureContext>)
  }
  get listenPools(): Map<string, IListenServer> {
    if (!this[listenPools]) {
      this[listenPools] = new Map()
    }
    return this[listenPools] as Map<string, IListenServer>
  }
  get socketPools(): Map<string, Socket> {
    if (!this[socketPools]) {
      this[socketPools] = new Map()
    }
    return this[socketPools] as Map<string, Socket>
  }
  get httpServer() {
    return this[httpServer]
  }
  get httpsServer() {
    return this[httpsServer]
  }
  get http2Server() {
    return this[http2Server]
  }
  get webSocketServer() {
    return this[webSocketServer]
  }
  get httpServerEnable() {
    return Boolean(this[httpServer])
  }
  get httpsServerEnable() {
    return Boolean(this[httpsServer])
  }
  get http2ServerEnable() {
    return Boolean(this[http2Server])
  }
  get webSocketServerEnable() {
    return Boolean(this[webSocketServer])
  }
}

function createConnectionListener(listener: Listener): (socket: Socket) => void {
  return connectionListenerFn.bind(listener)
}
/**
 * { function_description }
 *
 * @param      {<type>}  socket  The socket
 */
function connectionListenerFn(this: Listener, socket: Socket) {
  // 存储 链接管道
  this.socketPools.set((socket.remoteAddress + ':' + socket.remotePort), socket)
  // 存储解除方法
  let unsocket: (() => void) | undefined = () => {
    if (unsocket) {
      socket.off('end', unsocket)
      socket.off('close', unsocket)
      this.socketPools.delete(socket.remoteAddress + ':' + socket.remotePort)
      unsocket = void 0
    }
  }
  // 用于后续解除绑定
  socket.once('end', unsocket)
  // 用于后续解除绑定
  socket.once('close', unsocket)
  // 取得协议类型
  const type = (socket as any).server && ((socket as any).server as IListenServer).$easyke$type

  // 如果是 ssl、tls 类型
  if (type === 'ssl' || type === 'tls') {
    if (this.http2ServerEnable) {
      // 使用 http2 服务来处理
      (this[http2Server] as http2Server).emit('connection', socket)
    } else if (this.httpsServerEnable) {
      // 使用 https 服务来处理
      (this[httpsServer] as httpsServer).emit('connection', socket)
    } else {
      // 否则销毁链接
      socket.destroy()
    }
  } else {
    // 否则使用 http 服务来处理
    if (this[httpServer] && (this[httpServer] as httpServer).emit) {
      // 出发一个链接
      (this[httpServer] as httpServer).emit('connection', socket)
    } else {
      // 否则销毁链接
      socket.destroy()
    }
  }
}
/**
 * { function_description }
 *
 * @param      {Function}  options  The options
 */
function listenOptionsFormat(listener: Listener, options?: number | string | ListenOptions | FListenOptions): { type: listenType, listen: listen } {
  if (typeof options === 'function') {
    return listenOptionsFormat(listener as any, options(listener))
  }
  const res: { type: listenType, listen?: listen } = {
    type: 'tcp',
  }
  if (typeof options === 'string' || typeof options === 'number') {
    res.listen = isNumber(options) ? {
      port: Number(options),
    } : {
        path: (options as string),
      }
  } else if (typeof options === 'object') {
    res.type = options.type || 'tcp'
    if (options.path) {
      res.listen = {
        path: options.path,
      }
    } else {
      if (options.port) {
        res.listen = {
          port: Number(options.port),
        }
      }
      if (options.host || options.hostname) {
        res.listen = {
          host: options.host || options.hostname,
        }
      }
    }
  }
  if (res.listen === void 0 || res.listen === null) {
    res.listen = ({
      port: 0,
    })
  }
  return (res as { type: listenType, listen: listen })
}
/**
 * Determines if number.
 *
 * @param      {<type>}   obj     The object
 * @return     {boolean}  True if number, False otherwise.
 */
function isNumber(obj: number | string | any): boolean {
  return obj === +obj
}
