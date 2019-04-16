import {listener} from '@etsx/listener'
import { ModernBrowsers } from '@etsx/utils'

const { matchesUA } = require('browserslist-useragent')
const modernBrowsers: string[] = Object.keys(ModernBrowsers)
  .map((browser: string) => `${browser} >= ${((ModernBrowsers[browser] as string) || '0')}`)

function isModernBrowser(userAgent?: string): boolean {
  return Boolean(userAgent) && matchesUA(userAgent, {
    allowHigherVersions: true,
    browsers: modernBrowsers,
  })
}
export type modernRequest = listener.Request & {
  modernMode: boolean;
}
export default function modernMiddleware(req: listener.Request, res: listener.Response, next: listener.next) {
  const { socket = {}, headers } = req
  if ((socket as any).modernMode === undefined) {
    const userAgent = headers && headers['user-agent'];
    (socket as any).modernMode = isModernBrowser(userAgent)
  }
  (req as modernRequest).modernMode = (socket as any).modernMode
  next()
}
