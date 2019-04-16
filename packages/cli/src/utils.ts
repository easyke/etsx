import path from 'path'
import chalk from 'chalk'
import fs from 'graceful-fs'
import { options as EtsxOptionsBase } from 'etsx'
import { logger, stdEnv, defaultsDeepClone } from '@etsx/utils'
import { buildOptions } from '@etsx/builder'
import { listener } from '@etsx/listener'

const portReg = /^-p([0-9]|[1-9]\d|[1-9]\d{2}|[1-9]\d{3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/
const argvReg = /^-([a-zA-Z]|-[a-zA-Z][0-9a-zA-Z]{0,})$/

export type EtsxOptions = EtsxOptionsBase & {
  build?: buildOptions;
  server?: {
    listen: listener.ListenOptions;
  };
};
export type port = string | number | null
export function getProcessArgvs() {
  const argvs = process.argv
  let npmArgv = []
  let port: port = null
  try {
    npmArgv = process.env.npm_config_argv && JSON.parse(process.env.npm_config_argv || '[]')
    npmArgv = npmArgv && npmArgv.original
  } catch (e) { }
  if (Array.isArray(npmArgv)) {
    const options = []
    const optionValues = []
    for (let i = 0; i < npmArgv.length; i++) {
      const argv = npmArgv[i]
      const name = argvReg.exec(argv)
      if (typeof argv === 'string' && name && name[1]) {
        const option = Object.create(null)
        options.push(option)
        option.alias = name[1].length === 1
        option.name = option.alias ? name[1] : name[1].substr(1)
        if (!argvReg.test(npmArgv[i + 1])) {
          option.value = npmArgv[i + 1]
          optionValues.push(option.value)
          if (option.name === 'port' || option.name === 'p') {
            port = option.value
          }
          i++
        }
      } else if (portReg.test(argv)) {
        port = (portReg.exec(argv) as string[])[1]
      }
    }
    for (let i = 0; i < argvs.length; i++) {
      const argv = argvs[i];
      // 正则视图判断是否是一个参数
      const name = argvReg.exec(argv)
      // 如果是一个参数
      if (typeof argv === 'string' && name && name[1]) {
        // 下一个参数是一个值
        if (!argvReg.test(argvs[i + 1])) {
          // 跳过
          i++
        }
      } else if (name === null && optionValues.indexOf(argv) > -1) {
        // 清理这个来自npm的参数，防止干扰
        argvs.splice(i, 1)
        // i减去1
        i--
      }
    }
  }
  if (port) {
    argvs.push('--port', port.toString())
  }
  return argvs
}

export function parseBuildArgvs(argvs: string[]) {
  let buildIndex = 0
  const buildStr = '--build:'
  const buildLen = buildStr.length
  const builds: string[] = []
  const argvOutput = argvs.filter((item, index) => {
    if (typeof item === 'string' && item.indexOf(buildStr) === 0) {
      buildIndex = buildIndex || index
      Array.prototype.push.apply(builds, item.substr(buildLen).split(','))
      return false
    } else {
      return true
    }
  })
  if (!builds.length) {
    builds.push('all')
  }
  argvOutput.splice(
    buildIndex || argvOutput.length,
    0,
    ...builds.map((item) => buildStr + item))
  return argvOutput
}

export function logChanged(event: string, path: string) {
  logger.stopAndPersist(chalk.blue.bold(stdEnv.isWindows ? '»' : '↻'), chalk.blue(path))
}

export async function loadEtsxConfig(srcDir: string, configFile: string, builds: string[], buildExtend: string[]): Promise<EtsxOptions> {
  let options = {}
  const configFilePath = path.resolve(srcDir, configFile)
  if (fs.existsSync(configFilePath)) {
    try {
      delete require.cache[configFilePath]
      options = require(configFilePath) || {}
      if (options && (options as any).default) {
        options = (options as any).default
      }
      if (typeof options === 'function') {
        try {
          options = await options()
          if (options && (options as any).default) {
            options = (options as any).default
          }
        } catch (error) {
          error.message = 'Error while fetching async configuration:' + error.message
          throw new Error(error)
        }
      }
    } catch (error) {
      throw new Error(`load config file fail: ${configFile}`)
    }
  } else if (configFile !== 'etsx.config.js') {
    // 既然不是默认的配置文件就必须存在
    throw new Error(`Could not load config file: ${configFile}`)
  }
  const isBuildAll = builds.includes('all')
  return defaultsDeepClone<EtsxOptions>(options, {
    // 调试模式
    dev: (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev'),
    dir: {
      src: srcDir,
    },
    build: {
      buildExtend,
      browser: {
        enable: isBuildAll || builds.includes('web'),
      },
      weex: {
        // 启用 jsbundle - webpack 构建 - 如果 ios或安卓 构建，将启用 jsbundle - webpack 构建
        enable: isBuildAll || builds.includes('weex') || builds.includes('ios') || builds.includes('android'),
        // 启用 ios 构建
        enableIos: isBuildAll || builds.includes('ios'),
        // 启用 安卓 构建
        enableAndroid: isBuildAll || builds.includes('android'),
      },
    },
  }) as EtsxOptions
  // 返回配置项
}
