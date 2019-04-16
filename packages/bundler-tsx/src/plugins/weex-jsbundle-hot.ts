import url from 'url'
import net from 'net'
import tls from 'tls'
import pify from 'pify'
import http from 'http'
import http2 from 'http2'
import { isEmpty, logger } from '@etsx/utils'
import webpack from 'webpack'
import ws from 'ws'
const parse = url.parse;

const pathMatch = (url: string | undefined, path: string) => {
  try {
    return url && parse(url).pathname === path;
  } catch (e) {
    return false;
  }
}
type opts = {
  path: string;
  publicPath: string;
};
export class WeexJsbundle {
  isInitial: boolean;
  path: string;
  publicPath: string;
  originUrl: string;
  clients: Set<ws>;
  constructor(compiler: webpack.Compiler, opts: opts) {
    // 初始化钩子
    if (compiler) {
      this.apply(compiler)
    }
    this.isInitial = true
    this.path = opts.path || '/__weex_hot_reload_server'
    this.publicPath = opts.publicPath || '/_etsx/weex/'
    this.originUrl = ''
    this.clients = new Set()
    this.close = this.close.bind(this)
    this.handler = this.handler.bind(this)
  }
  async close() {
    this.isInitial = false
    const promises = Array.from(this.clients.values()).map((ws) => ws.close && pify(ws.close)())
    this.clients.clear()
    await (Promise.all(promises).catch((e) => logger.error(e)))
  }
  handler(ws: ws, req: http.IncomingMessage | http2.Http2ServerRequest, next: ((...args: any[]) => void)) {
    if (!this.isInitial) {
      return next && next()
    }
    if (!pathMatch(req.url, this.path)) {
      return next && next()
    }
    this.clients.add(ws)
    ws.once('error', () => this.clients.delete(ws))
    ws.once('close', () => this.clients.delete(ws))
    ws.once('end', () => this.clients.delete(ws))
    if (!this.originUrl) {

      const originUrl = getOrigin(req) || (Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin)
      if (originUrl) {
        // 清除最后的斜杆
        if (originUrl && originUrl[originUrl.length - 1] === '/') {
          this.originUrl = originUrl.slice(0, -1)
        } else {
          this.originUrl = originUrl
        }
      }
    }
  }
  broadcastHotReload() {
    if (!this.isInitial || !this.originUrl) {
      return
    }
    const data = {
      method: 'WXReloadBundle',
      params: this.originUrl + this.publicPath + `index.js`,
    }
    const body = JSON.stringify(data)
    this.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(body)
      } else {
        // 清理
        this.clients.delete(client)
        // 回收
        try {
          client.close()
        } catch (e) { }
      }
    })
  }
  apply(compiler: webpack.Compiler) {
    if (!compiler) {
      return
    }
    const onInvalid = () => {
      // webpack building...
      // 重新编译的开始的时候
    }
    // webpack done
    const broadcastHotReload = this.broadcastHotReload.bind(this)
    // Webpack 4
    if (compiler.hooks && compiler.hooks.compilation && compiler.hooks.compilation.tap) {
      compiler.hooks.invalid.tap('weexJsbundle', onInvalid)
      compiler.hooks.done.tap('weexJsbundle', broadcastHotReload)
    } else {
      compiler.plugin('invalid', onInvalid)
      compiler.plugin('done', broadcastHotReload)
    }
  }
}
export default WeexJsbundle

function getProtocol(req: any): string {
  let protocol

  if (req) {
    protocol = req.protocol
    /**
     * @see https://cloud.tencent.com/developer/section/1190031
     */
    if (!protocol) {
      protocol = req.headers['x-forwarded-proto']
    }

    if (!protocol) {
      protocol = req.headers['Front-End-Https'] === 'on' ? 'https:' : 'http'
    }

    if (!protocol) {
      protocol = req.headers['X-Forwarded-Protocol']
    }

    if (!protocol) {
      protocol = req.headers['X-Forwarded-Ssl'] === 'on' ? 'https:' : 'http'
    }

    if (!protocol) {
      protocol = req.headers['X-Url-Scheme']
    }

    if (!protocol) {
      // 满足是一条 socket
      if (req.socket instanceof net.Socket) {
        // 加密socket
        protocol = req.socket instanceof tls.TLSSocket ? 'https' : 'http'
      }
    }
  }

  if (protocol && protocol.indexOf('http') > -1 && isHttps(req)) {
    protocol = 'https:'
  } else if (!protocol && isHttps(req)) {
    protocol = 'https:'
  }

  if (protocol && protocol.substr(-1) !== ':') {
    protocol += ':'
  }

  return protocol
}

function isHttps(req: any) {
  // Test using req.connection.encrypted
  const encrypted = isEmpty(req.connection.encrypted) ? null : req.connection.encrypted === true
  if (encrypted) {
    return true
  }

  // Test using req.protocol
  const httpsProtocol = isEmpty(req.protocol) ? null : req.protocol === 'https'
  if (httpsProtocol) {
    return true
  }

  // Test using x-forwarded-proto header
  const httpsXforwarded = isEmpty(req.headers['x-forwarded-proto'])
    ? null
    : req.headers['x-forwarded-proto'].indexOf('https') !== -1
  if (httpsXforwarded) {
    return true
  }

  // If no detection method is available return null
  if (encrypted === null && httpsProtocol === null && httpsXforwarded === null) {
    return null
  }

  return false
}

function getHost(req: any): string {
  return (req && (req.hostname || req.host || (req.headers && req.headers.host)))
}

function getOrigin(req: any) {
  return getProtocol(req) + '//' +  getHost(req)
}
