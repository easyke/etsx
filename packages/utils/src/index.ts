// 打印日志
import logger from './node/logger'
import Hookable, * as hookable from './node/hookable'
export * from './utils'
export * from './lang'
export * from './resolve'
export * from './route'
export * from './serialize'
export * from './app/task'
export * from './timer'
export { proxy } from './node/proxy'
export { stdEnv, setIsDebug, setNodeENV } from './std-env'
export * from './context'

const ModernBrowsers = require('../data/modern-browsers.json')

export {
  logger,
  hookable,
  Hookable,
  ModernBrowsers,
}
