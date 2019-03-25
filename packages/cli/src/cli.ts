
import ip from 'ip'
import Etsx from 'etsx'
import chalk from 'chalk'
import Builder from '@etsx/builder'
import { logger, getOptions } from '@etsx/utils'
import { listener as listen, Listener } from '@etsx/listener'
import { logChanged, loadEtsxConfig, EtsxOptions } from './utils'
import detect from 'detect-port';
import { device as iosDevice } from '@etsx/bundler-ios';
import { bundler as androidBundler } from '@etsx/bundler-android';
import inquirer from 'inquirer';

export const etsx = Symbol('etsx')
export const listener = Symbol('listener')

export type port = number;
type build =
  'all' |
  'ios' |
  'web' |
  'weex' |
  'wechatmp' |
  'baidump' |
  'alipaymp' |
  'android';
export class Cli {
  isStart: boolean;
  host: string;
  unixSocket: string;
  port: port;
  [etsx]?: Etsx;
  builds: build[];
  [listener]?: Listener;
  etsxOptions: EtsxOptions;
  srcDir: string;
  configFile: string;
  devBaseUrl: string;
  weexHotReloadWs: string;
  chooseIosDeviceLists?: iosDevice.device[];
  chooseAndroidDeviceLists?: androidBundler.device[];
  constructor(options?: getOptions<Cli>) {
    if (!options) {
      options = {}
    }
    this.onWatchRestart = this.onWatchRestart.bind(this)
    this.onBundlerChange = this.onBundlerChange.bind(this)
    this.srcDir = options.srcDir || process.cwd()
    this.isStart = typeof options.isStart === 'undefined' ? false : options.isStart
    this.configFile = options.configFile || 'etsx.config.js'
    this.port = options.port || 3000
    this.host = options.host || ''
    this.unixSocket = options.unixSocket || ''
    this.builds = Array.isArray(options.builds) ? options.builds : ['all']
    this.devBaseUrl = options.devBaseUrl || ''
    this.weexHotReloadWs = options.weexHotReloadWs || ''
    this.etsxOptions = {}
  }
  async run() {
    // 创建一个Etsx
    await this.createEtsx()
    // 加载项目配置项 - 并且实例化项目
    logger.log(`rootDir   : ${this.etsx.options.dir.root}`)
    logger.log(`srcDir    : ${this.etsx.options.dir.src}`)
    logger.log(`isStart   : ${this.isStart}`)
    logger.log(`isDev     : ${this.etsx.options.dev}`)
    logger.log(`isDebug   : ${this.etsx.options.debug}`)
    // 开发构建模式
    const isBuilderByDev = this.etsx.options.dev
    // 产品构建模式
    const isBuilderByPro = this.isStart === false
    // 构建模式
    const isBuilder = isBuilderByPro || isBuilderByDev
    // 服务模式
    const isServer = isBuilderByDev || this.isStart
    // 开发模式 || 服务模式
    if (isServer) {
      // 启动服务
      await this.runListen()
    }
    if (this.devBaseUrl) {
      logger.log(`devBaseUrl: ${this.devBaseUrl}`)
    }
    if (this.weexHotReloadWs) {
      logger.log(`weexHotWs : ${this.weexHotReloadWs}`)
    }
    // 开发模式[非打包模式] 或 打包模式[非开发模式]
    if (isBuilder) {
      // 开始构建
      await this.runBuilder()
    }
  }
  async runBuilder() {
    if (!this.etsx) {
      throw new Error('not etsx instance');
    }
    this.etsx.hook('watch:restart', this.onWatchRestart)

    this.etsx.hook('bundler:change', this.onBundlerChange)
    // 生成器
    const builder = new Builder(this.etsx)
    // 开始构建
    await builder.build()
    // 如果是开发模式
    if (this.etsx.options.dev) {
    // 开始观看serverMiddleware的变化
      await builder.watchRestart()
    }

    // 必须是 开发模式 和 打包模式 才支持使用 weex - app 命令
    if (this.isStart === false) {

      if (this.builds.includes('all') || this.builds.includes('ios')) {
        logger.log(`启动ios编译`)
        if (this.etsx.options.dev && !this.chooseIosDeviceLists) {
          // 如果是开发模式，没有选择设备列表，将自动选择
          this.chooseIosDeviceLists = [await this.chooseDevice(
            (await iosDevice.getIPhoneLists())
            .map((device) => ({
              name: `${device.name} ios: ${device.version} ${device.isSimulator ? '(Simulator)' : ''}`,
              value: device,
            })),
          )];
        }
        await builder.bundlerIos.build(this.chooseIosDeviceLists)
      }
      if (this.builds.includes('all') || this.builds.includes('android')) {
        logger.log(`启动android编译`)
        if (this.etsx.options.dev && !this.chooseAndroidDeviceLists) {
          this.chooseAndroidDeviceLists = [await this.chooseDevice(
            (await builder.bundlerAndroid.getDevicesWithRetry())
              .map((device) => ({
                name: `${device.udid} [${device.state}]`,
                value: device,
              })),
          )];
        }
        await builder.bundlerAndroid.build(this.chooseAndroidDeviceLists)

      }
    }
  }

  async chooseDevice<T extends any>(input: Array<{ name: string; value: T; }>): Promise<T> {
    if (!input || !input.length) {
      throw new Error('No choices device.')
    }
    const choices = input.concat([])
    choices.unshift(new inquirer.Separator(' = devices = ') as any)
    return (await inquirer.prompt([
      {
        type: 'list',
        prefix: chalk.cyan(logger.prefix) + ' ' + logger.symbols.question,
        message: 'Choose one of the following devices',
        name: 'chooseDevice',
        choices,
      },
    ]) as any).chooseDevice as T
  }
  async runListen() {
    // 试图获取监听配置和选项配置
    const { listen: listenOts = null, ...optionsInput } = this.etsxOptions.server || {}
    const options = optionsInput || Object.create(null)
    let listen: listen.ListenOptions = {}
    if (this.unixSocket) {
      listen = {
        path: this.unixSocket,
      }
    } else if (this.port || this.host) {
      listen = {
        port: await new Promise((resolve, reject) => {
          // 检测 port 端口占用情况
          detect(this.port, (e: any, newPort: port) => {
            if (e) {
              reject(e)
            } else if (this.port === newPort) {
              resolve(this.port)
            } else {
              if (this.etsx.options.dev) {
                logger.info(`[${this.port}]Port is occupied, automatically try to use [${newPort}] in development mode`)
                resolve(newPort)
              } else {
                reject(new Error(`Port [${this.port}] is occupied, please check`))
              }
            }
          })
        }),
      }
      if (this.host) {
        listen.host = this.host
      }
    }
    // 渲染app
    if (this.etsx.options.dev) {
      listen.type = 'tcp'
    } else {
      listen = listenOts || listen
    }
    // 分离监听配置和 项目配置
    logger.log('listen    : %s', listen)
    logger.log('listen-opt: %s', options)
    // 创建一个监听器
    this.listener = new Listener(options)
    // 绑定渲染处理者到监听器
    this.bindRenderToListen()
    logger.log(`The listener is created`)
    // 监听
    await this.listener.listen(listen)
    let devBaseUrl = ''
    const computeURLs = new Set()
    this.listener.listenPools.forEach((server) => {
      const address = server.address()
      const type = server.$easyke$type
      const listen = server.$easyke$listen
      let url: string = ''
      let socket: string = ''
      if (typeof address === 'string') {
        socket = address
      } else if (address && typeof address === 'object') {
        let host
        switch (address.address) {
          case '::1':
          case '0:0:0:0:0:0:0:1':
          case '0:0:0:0:0:0:7f00:01':
          case '127.0.0.1':
            host = 'localhost';
            break
          /**
           * unspecified IPv6 address
           * @see:https://en.wikipedia.org/wiki/IPv6_address#Unspecified_address
           */
          case '::':
          /**
           * unspecified IPv4 address
           * @see:https://en.wikipedia.org/wiki/0.0.0.0
           */
          case '0.0.0.0':
            host = ip.address()
            break
        }
        if (!host) {
          host = (listen && (listen.host || (listen as any).hostname)) || ip.address()
        }
        const port = address.port || (listen && listen.port) || ''
        url = `http${(type === 'ssl' || type === 'tls') ? 's' : ''}://${host}`
        if (port) {
          url += ':' + port
        }
        if (!devBaseUrl && url) {
          devBaseUrl = url
        }
      }
      if (url || socket) {
        computeURLs.add({
          url,
          type,
          socket,
        })
        logger.log(`listener : ${url || socket}`)
      }
    })
    if (!this.devBaseUrl) {
      this.devBaseUrl = devBaseUrl || this.devBaseUrl
    }
    if (!this.weexHotReloadWs && this.devBaseUrl) {
      this.weexHotReloadWs = this.devBaseUrl.replace('https://', 'wss://').replace('http://', 'ws://') + '/__weex_hot_reload_server'
    }

    // 调用钩子
    await this.etsx.callHook('listen', this.listener, this.etsx, computeURLs)

    return computeURLs
  }
  /**
   * 加载项目配置项
   */
  async loadEtsxConfig() {
    this.etsxOptions = await loadEtsxConfig(this.srcDir, this.configFile, this.builds)
  }
  /**
   * 加载项目配置项 - 并且实例化项目
   */
  async createEtsx(): Promise<Etsx> {
    // 加载项目配置项
    await this.loadEtsxConfig()
    // 实例化etsx项目
    this.etsx = new Etsx(this.etsxOptions)
    // 绑定渲染处理者到监听器
    this.bindRenderToListen()
    return this.etsx
  }
  bindRenderToListen() {
    if (this[listener]) {
      this.listener.off('request', this.etsx.render)
      this.listener.on('request', this.etsx.render)
      this.listener.off('webSocket', this.etsx.render)
      this.listener.on('webSocket', this.etsx.render)
    }
  }
  onBundlerChange(path: string) {
    // 打印构建过程中，变化的文件
    logChanged('change', path)
  }
  async onWatchRestart({ event, path }: { event: string, path: string }, etsx: Etsx) {
    // 打印中间件，监视列表中，变化的文件
    logChanged(event, path)
    // 清除钩子
    etsx.clearHook('watch:restart', this.onWatchRestart)
    // 清除钩子
    etsx.clearHook('bundler:change', this.onBundlerChange)
    // 关闭项目
    await etsx.close()
    // 创建一个Etsx
    await this.createEtsx()
    // 重新构建
    await this.runBuilder()
  }
  get etsx(): Etsx {
    if (this[etsx]) {
      return this[etsx] as Etsx
    } else {
      throw new Error('not etsx')
    }
  }
  set etsx(value: Etsx) {
    this[etsx] = value
  }
  get listener(): Listener {
    if (this[listener]) {
      return this[listener] as Listener
    } else {
      throw new Error('not Listener')
    }
  }
  set listener(value: Listener) {
    this[listener] = value
  }
}
export default Cli
