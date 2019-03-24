import { logger } from '@etsx/utils'
import { getProcessArgvs, parseBuildArgvs } from './utils'
// 引入 chalk
import chalk from 'chalk'
// 版本处理工具
import semver from 'semver'
// 命令行处理工具
import program from 'commander'

let Cli: any

const pkg: {
  version: string;
} = require('../package.json')

// 默认不是一个start命令
program.isStart = false
// 项目路径
program.srcDir = process.cwd()
// 判断版本输出版本
program.version(pkg.version)
  .option('-v --version', 'output the version number')
  .option('-s --silent', 'hide all messages', false)
  .option('-p --port [port]', 'server port', process.env.port || process.env.npm_package_config_port || 3000)
  .option('-H --hostname [hostname]', 'server hostname', process.env.hostname || process.env.host || process.env.npm_package_config_host || '')
  .option('-n --unix-socket [hostname]', 'unix socket', process.env.unix_socket || process.env.npm_package_config_unix_socket || '')
  .option('--build:all', 'build all app', false)
  .option('--build:web', 'build browser', false)
  .option('--build:ios', 'build ios app', false)
  .option('--build:weex', 'build weex-jsbundle not run app', false)
  .option('--build:android', 'build android app', false)
  .option('-c --config-file [path]', 'Path to etsx config file (default: etsx.config.js)', 'etsx.config.js')
  .option('--clean', 'clean etsx before build android app')

program.on('--help', () => {
  const br = '\n'
  const examples = [
    'Examples:',
    br,
    chalk.bold('  # Development Android etsx'),
    '  $ ' + chalk.yellow(`etsx dev --build:android`),
    br,
    chalk.bold('  # Development iOS etsx'),
    '  $ ' + chalk.yellow(`etsx dev --build:ios`),
    br,
    chalk.bold('  # Development web etsx'),
    '  $ ' + chalk.yellow(`etsx dev --build:web`),
    br,
    chalk.bold('  # Build Android etsx (for production)'),
    '  $ ' + chalk.yellow(`etsx build --build:android`),
    br,
    chalk.bold('  # Build iOS etsx (for production)'),
    '  $ ' + chalk.yellow(`etsx build --build:ios`),
    br,
    chalk.bold('  # Build Android And iOS etsx (for production)'),
    '  $ ' + chalk.yellow(`etsx build --build:ios,android`),
    chalk.gray('  # Or you can also'),
    '  $ ' + chalk.yellow(`etsx build --build:ios --build:android`),
    br,
    chalk.bold('  # Build web etsx (for production)'),
    '  $ ' + chalk.yellow(`etsx build --build:web`),
    br,
  ]
  if (logger.stdout) {
    logger.stdout.write(examples.map((line) => '  ' + line).join(br))
  }
})
/**
 * 开始命令
 */
program.command('dev [srcDir]')
  .description('Development etsx')
  .action((srcDir?: string) => {
    process.env.NODE_ENV = 'development'
    program.isStart = false
    program.srcDir = srcDir
    runCli()
  })
/**
 * 开始命令
 */
program.command('build [srcDir]')
  .description('Build etsx (for production)')
  .action((srcDir?: string) => {
    process.env.NODE_ENV = 'production'
    program.isStart = false
    program.srcDir = srcDir
    runCli()
  })
/**
 * 开始命令
 */
program.command('start [srcDir]')
  .description('Start etsx (for production)')
  .action((srcDir?: string) => {
    process.env.NODE_ENV = 'production'
    program.isStart = true
    program.srcDir = srcDir
    runCli()
  })

export async function runCli(): Promise<any> {
  if (Cli) {
    initBuildByProgram(program)
    // 在此才开始引入是为了让之前的环境变量修改有效
    return (new Cli(program)).run().then((...args: any[]) => {
      if (program.resolveAndReject && typeof program.resolveAndReject[0] === 'function') {
        program.resolveAndReject[0](...args)
      }
      program.resolveAndReject = void 0
    }, (...args: any[]) => {
      if (program.resolveAndReject && typeof program.resolveAndReject[1] === 'function') {
        program.resolveAndReject[1](...args)
      }
      program.resolveAndReject = void 0
    })
  } else {
    Cli = (await import('./cli')).Cli as any
    return runCli()
  }
}
export function launch(argv: string[] = getProcessArgvs()) {
  // 设置当前显示内容为运行中
  logger.start('runing...')
  // 直接输出版本号
  if (process.argv.indexOf('-v') > -1) {
    // 显示版本号
    logger.log(pkg.version)
    // 退出进程
    process.exit(0)
  }
  // 如果node的版本大于，引入v8-compile-cache
  if (semver.satisfies(process.versions.node, '>= 6.0.0')) {
    // require('v8-compile-cache')
  }
  argv = parseBuildArgvs(argv || [])
  return new Promise((resolve, reject) => {
    try {
      program.resolveAndReject = [resolve, reject]
      program.reject = reject
      resolve = reject = () => void 0
      program.parse(argv)
      if (program.args.length < 1) {
        logger.stop()
        return program.help()
      }
    } catch (e) {
      if (typeof program.reject === 'function') {
        program.reject(e)
      }
    }
  })
}
export {
  program,
  launch as default,
}

export const buildAll: string[] = [
  'all',
  'ios',
  'web',
  'weex',
  'android',
]

function initBuildByProgram(program: object) {
  const cliBuilds = Object.keys(program).concat(Object.getOwnPropertyNames(program)).filter((item: string) => item && item.indexOf('build:') === 0)
  const builds = buildAll.filter((item) => cliBuilds.indexOf('build:' + item) > -1)

  if (!builds.length || builds.indexOf('all') > -1) {
    return buildAll
  }
  (program as any).builds = builds
}
