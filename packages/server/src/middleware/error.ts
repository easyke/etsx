import fs from 'fs';
import path from 'path';
import { logger } from '@etsx/utils';
import { listener } from '@etsx/listener';
const Youch = require('@nuxtjs/youch')

export default function({ resources, options }) {
  return function errorMiddleware(err: Error | any, req: listener.Request, res: listener.Response, next: listener.next) {
    // ensure statusCode, message and name fields

    const error = {
      statusCode: err.statusCode || 500,
      message: err.message || 'Project Server Error',
      name: !err.name || err.name === 'Error' ? 'ProjectServerError' : err.name,
    }
    const errorFull = err instanceof Error ? err : typeof err === 'string'
      ? new Error(err) : new Error(err.message || JSON.stringify(err))
    errorFull.name = error.name
    (errorFull as any).statusCode = error.statusCode

    const sendResponse = (content: Buffer | string, type = 'text/html') => {
      // Set Headers
      res.statusCode = error.statusCode;
      res.statusMessage = error.name;
      res.setHeader('Content-Type', type + '; charset=utf-8');
      res.setHeader('Content-Length', Buffer.byteLength(content));
      res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');

      // Send Response
      (res as any).write(content, 'utf-8');
      res.end()
    }

    // Check if request accepts JSON
    const hasReqHeader = (header: string, includes: string) => {
      const item = req.headers[header]
      if (typeof item === 'string') {
        return item.toLowerCase().includes(includes)
      } else if (Array.isArray(item)) {
        return item.filter((t: string) => t && t.toLowerCase().includes(includes)).length > 0
      } else {
        return false
      }
    }

    const isJson =
      hasReqHeader('accept', 'application/json') ||
      hasReqHeader('user-agent', 'curl/')

    // 禁用调试模式时，使用基本错误，只显示简约错误
    if (!options.debug) {
      // 我们隐藏了最终用户的实际错误，因此请在服务器日志中显示它们
      if (err.statusCode !== 404) {
        // 打印到日志中
        logger.error(err)
      }
      // Json format is compatible with Youch json responses
      // Json格式与Youch json响应兼容
      const json = {
        status: error.statusCode,
        message: error.message,
        name: error.name,
      }
      if (isJson) {
        sendResponse(JSON.stringify(json, undefined, 2), 'text/json')
        return
      }
      const html = resources.errorTemplate(json)
      sendResponse(html)
      return
    }

    // 显示堆栈跟踪
    const youch = new Youch(
      errorFull,
      req,
      readSourceFactory({
        srcDir: options.srcDir,
        rootDir: options.rootDir,
        buildDir: options.buildDir,
        resources,
      }),
      options.router.base,
      true,
    )
    if (isJson) {
      youch.toJSON().then((json: any) => {
        sendResponse(JSON.stringify(json, undefined, 2), 'text/json')
      })
    } else {
      youch.toHTML().then((html: string | Buffer) => sendResponse(html))
    }
  }

}
const readSourceFactory = ({ srcDir, rootDir, buildDir, resources }) => async function readSource(frame) {
  // 从头到尾删除 [webpack:///] 和 查询字符串[query string]
  const sanitizeName = (name: string) =>
    name ? name.replace('webpack:///', '').split('?')[0] : null
  // 去除
  frame.fileName = sanitizeName(frame.fileName)

  // 如果frame.fileName没有值，直接中断返回
  /* istanbul ignore if */
  if (!frame.fileName) {
    return
  }

  // 这个文件可能在一些目录中
  const searchPath = [
    srcDir,
    rootDir,
    path.join(buildDir, 'dist', 'server'),
    buildDir,
    process.cwd(),
  ]

  // 扫描文件系统以获取真实来源
  for (const pathDir of searchPath) {
    const fullPath = path.resolve(pathDir, frame.fileName)
    const source = await new Promise((resolve) => {
      fs.readFile(fullPath, 'utf-8', (e, res) => resolve(e ? null : res))
    })
    if (source) {
      frame.contents = source
      frame.fullPath = fullPath
      if (path.isAbsolute(frame.fileName)) {
        frame.fileName = path.relative(rootDir, fullPath)
      }
      return
    }
  }

  // Fallback: use server bundle
  // TODO: restore to if after https://github.com/istanbuljs/nyc/issues/595 fixed
  /* istanbul ignore next */
  if (!frame.contents) {
    frame.contents = resources.serverBundle.files[frame.fileName]
  }
}
