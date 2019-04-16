// 收集初始信息
// 是否为ci模式
let isCI = false
// 是否为调试模式
let isDebug = false
// 是否为终端模式
let tty = false
// nodeENV
let nodeENV = 'development'
// 目前是否为浏览器
const browser = typeof window !== 'undefined'
// 系统
let platform = ''
// 最小的输出
let minimal = false

// 环境变量转布尔值
function toBoolean(val: any): boolean {
  return (!val || val === 'false') ? false : true
}

// 判断是否存在进程，有将依赖进程进一步判断
if (typeof process !== 'undefined') {
  // 获取系统
  if (process.platform) {
    platform = String(process.platform)
  }

  // 判断是否存在终端[TTY]
  if (process.stdout) {
    tty = toBoolean(process.stdout.isTTY)
  }

  // 是否为ci模式,Is CI
  isCI = Boolean(require('ci-info').isCI)

  // 依赖进程中的环境变量进一步矫正数据  Env dependent
  if (process.env) {
    // 矫正 NODE_ENV
    if (process.env.NODE_ENV) {
      nodeENV = process.env.NODE_ENV
    }

    // 是否为调试模式 DEBUG
    isDebug = toBoolean(process.env.DEBUG)

    // 最小输出 MINIMAL
    minimal = toBoolean(process.env.MINIMAL)
  }
}
// Construct env object
// Export env
export const stdEnv = {
  // 是否为浏览器
  browser,
  // 是否为自动化测试
  get test(): boolean { return nodeENV === 'test' },
  // 是否为开发模式
  get dev(): boolean { return nodeENV === 'development' || nodeENV === 'dev' },
  // 是否为产品生产环境
  get production(): boolean { return nodeENV === 'production' },
  // 是否为调试模式
  get debug(): boolean { return isDebug },
  // 是否为
  ci: isCI,
  // 判断是否存在终端
  tty,

  // Compute minimal
  get minimal(): boolean { return Boolean(minimal || stdEnv.ci || stdEnv.test || !stdEnv.tty) },
  get minimalCLI(): boolean { return stdEnv.minimal },
  // 微软windows系统
  isWindows: /^win/i.test(platform),
  // 苹果系列 类unix 系统
  isDarwin: /^darwin/i.test(platform),
  // linux系列 类unix 系统
  isLinux: /^linux/i.test(platform),
  // FreeBSD see:https://baike.baidu.com/item/FreeBSD/413712?fr=aladdin
  isFreebsd: /^freebsd/i.test(platform),

  get isUnix() { return Boolean(stdEnv.isDarwin || stdEnv.isLinux || stdEnv.isFreebsd) },
}
export function setIsDebug(is: boolean) {
  isDebug = Boolean(is)
}
export function setNodeENV(str: string) {
  nodeENV = str
  return stdEnv
}
export default stdEnv
