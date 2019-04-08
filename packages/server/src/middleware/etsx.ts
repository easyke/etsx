import generateETag from 'etag'
import fresh from 'fresh'
import { Etsx, EtsxOptions } from 'etsx'
import { logger, getContext } from '@etsx/utils'
import { listener } from '@etsx/listener'
import { renderer, Renderer } from '@etsx/renderer';

type input = {
  options: EtsxOptions;
  etsx: Etsx;
  resources: renderer.resources;
  renderRoute: Renderer['renderRoute'];
}
export default ({ options, etsx, renderRoute, resources }: input) => async function etsxMiddleware(req: listener.Request | any, res: listener.Response | any, next: listener.next) {
  // 生成上下文
  const context = getContext(req, res)
  // 获取渲染路径
  const url = req.url
  // 假设返回 200
  res.statusCode = 200
  try {
    // 试图渲染
    const result = await renderRoute(url, context)
    // 调用路由钩子
    await etsx.callHook('render:route', url, result, context)
    const {
      // 渲染后的html
      html,
      // CSP: script-src
      cspScriptSrcHashSet,
      // 错误对象
      error,
      // 已经重定向
      redirected,
      //
      getPreloadFiles,
    } = result

    if (redirected) {
      etsx.callHook('render:routeDone', url, result, context)
      return html
    }
    if (error) {
      // res.statusCode = context.error.statusCode || 500
    }

    // 添加ETag标头
    if (!error && options.render.etag) {
      // 根据内容和和配置选项中的render.etag生成
      const etag = generateETag(html, options.render.etag)
      if (fresh(req.headers, { etag })) {
        res.statusCode = 304
        res.end()
        etsx.callHook('render:routeDone', url, result, context)
        return
      }
      res.setHeader('ETag', etag)
    }
/*
    // HTTP2 push headers for preload assets
    // 用于预加载资产的HTTP2推送标头 - 暂时不开发
    if (!error && options.render.http2.push) {
      // Parse resourceHints to extract HTTP.2 prefetch/push headers
      // https://w3c.github.io/preload/#server-push-http-2
      const preloadFiles = getPreloadFiles()

      const { pushAssets } = options.render.http2
      const { publicPath } = resources.clientManifest

      const links = pushAssets
        // 使用配置选项的方法
        ? pushAssets(req, res, publicPath, preloadFiles)
        // 使用默认的方法
        : defaultPushAssets(publicPath, preloadFiles)

      // Pass with single Link header
      // https://blog.cloudflare.com/http-2-server-push-with-multiple-assets-per-link-header
      // https://www.w3.org/Protocols/9707-link-header.html
      if (links.length > 0) {
        res.setHeader('Link', links.join(', '))
      }
    }

    if (options.render.csp) {
      const { allowedSources, policies } = options.render.csp
      const cspHeader = options.render.csp.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy'

      res.setHeader(cspHeader, getCspString({ cspScriptSrcHashSet, allowedSources, policies, isDev: options.dev }))
    }
*/
    // 返回响应头
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    // 不支持 断点续传
    res.setHeader('Accept-Ranges', 'none')
    // 内容长度
    res.setHeader('Content-Length', Buffer.byteLength(html))
    // 输出html 结束响应
    res.write(html, 'utf8')
    res.end()
    // 调用 渲染路由完毕 钩子
    etsx.callHook('render:routeDone', url, result, context)
    // 返回html
    return html
  } catch (err) {
    /* istanbul ignore if */
    if (context && context.redirected) {
      logger.error(err)
      return err
    }

    next(err)
  }
}

const defaultPushAssets = (publicPath, preloadFiles) => {
  const links = []
  preloadFiles.forEach(({ file, asType }) => {
    // 默认情况下，我们只预加载脚本或css
    /* istanbul ignore if */
    if (asType !== 'script' && asType !== 'style') {
      return
    }

    links.push(`<${publicPath}${file}>; rel=preload; as=${asType}`)
  })
  return links
}

const getCspString = ({ cspScriptSrcHashSet, allowedSources, policies, isDev }) => {
  const joinedHashSet = Array.from(cspScriptSrcHashSet).join(' ')
  const baseCspStr = `script-src 'self'${isDev ? ` 'unsafe-eval'` : ''} ${joinedHashSet}`

  if (Array.isArray(allowedSources)) {
    return `${baseCspStr} ${allowedSources.join(' ')}`
  }

  const policyObjectAvailable = typeof policies === 'object' && policies !== null && !Array.isArray(policies)

  if (policyObjectAvailable) {
    const transformedPolicyObject = transformPolicyObject(policies, cspScriptSrcHashSet)

    return Object.entries(transformedPolicyObject).map(([k, v]) => `${k} ${v.join(' ')}`).join('; ')
  }

  return baseCspStr
}

const transformPolicyObject = (policies, cspScriptSrcHashSet) => {
  const userHasDefinedScriptSrc = policies['script-src'] && Array.isArray(policies['script-src'])

  // Self is always needed for inline-scripts, so add it, no matter if the user specified script-src himself.

  const hashAndPolicySet = cspScriptSrcHashSet
  hashAndPolicySet.add(`'self'`)

  if (!userHasDefinedScriptSrc) {
    policies['script-src'] = Array.from(hashAndPolicySet)
    return policies
  }

  new Set(policies['script-src']).forEach((src) => hashAndPolicySet.add(src))

  policies['script-src'] = Array.from(hashAndPolicySet)

  return policies
}
