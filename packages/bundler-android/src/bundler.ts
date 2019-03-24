import path from 'path';
import ADB from 'appium-adb';
import { logger, sequence } from '@etsx/utils'
import { Builder, BuildModule } from '@etsx/builder'
import childProcess from 'child_process';

export type device = {
  udid: string;
  state: string;
};
export class Bundler extends BuildModule {
  builder: Builder;
  adb?: ADB;
  constructor(builder: Builder) {
    super(builder.etsx);
    this.builder = builder
  }
  async getADB(): Promise<ADB> {
    if (!this.adb) {
      this.adb = await ADB.createADB();
    }
    return this.adb
  }
  async build(input?: device | string | device[] | string[]) {
    let devices: device[] = []
    // 开发模式 - 因为调试设备需要 选择设备
    if (this.options.dev) {
      logger.log(`获取选择的android设备`)
      // 强制转数组
      if (input && !Array.isArray(input)) {
        input = [(input)] as device[] | string[]
      }
      const deviceLists = await this.getDevicesWithRetry()
      // 过滤选择的设备，必须在列表内
      if (Array.isArray(input) && input.length) {
        input.forEach((device: device | string) => {
          devices.push(...(deviceLists as device[]).filter((t) => (typeof device === 'string' ? device : device.udid) === t.udid))
        })
      }
      // 没有任何选择的设备的时候提示选择
      if (!devices || !devices.length) {
        if (deviceLists.length > 1) {
          logger.log(`由于您没有传入选择的android设备，自动选择了第一台设备[${deviceLists[0].udid}]`)
          devices = [deviceLists[0]]
        }
      }
      devices.forEach((device) => logger.log(`选择了以下设备:${device.udid} [${device.state}]`))
    }
    // 目前只是允许一台
    devices.length = 1
    logger.info(`start Android app`)
    // 复制 jsBundle js资源
    await this.copyJsbundleAssets()

    // 构建app
    await this.buildApp()
    // 最后一步
    if (this.options.dev) {
      await sequence(devices, async (device) => {
        // 安装app
        await this.installApp(device)
        // 开发模式需要运行app - 因为调试设备需要
        await this.runApp(device, this.weexHotReloadWs)
      })
    } else {
      // 生产模式需要复制打包好的 apk 出来
      await this.copyReleaseAssets()
    }
  }
  /**
   * 复制 weex的Jsbundle
   */
  async copyJsbundleAssets() {
    // const bundlejsPath = path.join(this.androidPath, 'app/src/main/assets/dist')
    // console.log('ofs', this.ofs)
    // console.log('bundlejsPath', bundlejsPath)
    // throw new Error('4')
  }
  /**
   * 复制导出包到指定位置
   */
  async copyReleaseAssets() {
  }
  /**
   * 获取已经连接的设备
   */
  async getDevicesWithRetry(timeoutMs: number = 2000): Promise<device[]> {
    const adb = await this.getADB()
    return adb.getDevicesWithRetry(timeoutMs)
  }

  async runApp(device: device, weexHotReloadWs?: string): Promise<void> {
    let packageName: string = ''
    const adb = await this.getADB()
    try {
      const manifest = await new Promise<Buffer|string>((resolve, reject) => {
        this.lfs.readFile(
          path.join(this.options.dir.weex.android, 'app/src/main/AndroidManifest.xml'),
          (err, res) => err ? reject(err) : resolve(res),
        )
      })
      if (manifest) {
        const res = (Buffer.isBuffer(manifest) ? manifest.toString() : (manifest || '')).match(/package="(.+?)"/)
        if (res && res[1]) {
          packageName = res[1]
        }
      }
    } catch (error) {
      if (!packageName && this.weexOptions.androidAppId) {
        packageName = this.weexOptions.androidAppId
      } else {
        throw error;
      }
    }
    adb.setDevice(device)
    await adb.shell([
      'am',
      'start',
      '-n',
      `${packageName}/.SplashActivity`,
      '-d',
      JSON.stringify(JSON.stringify({ Ws: weexHotReloadWs })),
    ])
  }

  async installApp(device: device, apkPath?: string): Promise<void> {
    let apkName = 'app/build/outputs/apk/weex-app.apk';
    if (!this.lfs.existsSync(path.join(this.options.dir.weex.android, apkName))) {
      // Android Studio 3.0
      apkName = 'app/build/outputs/apk/debug/weex-app.apk';
    }
    apkPath = path.join(this.options.dir.weex.android, apkName)
    const adb = await this.getADB()
    adb.setDevice(device)
    await adb.install(apkPath)
  }
  /**
   * build the iOS app on simulator or real device
   * @param {Object} device
   * @param {Object} xcode project
   * @param {Object} options
   */
  async buildApp(isClean: boolean = true): Promise<void> {
    // 提示
    logger.info(`Buiding project...`)

    const clean = isClean ? ' clean' : ''

    return new Promise<void>((resolve, reject) => {
      childProcess.exec(
        process.platform === 'win32' ? `call gradlew.bat ${clean} assembleDebug` : `./gradlew ${clean} assembleDebug`,
        {
          cwd: this.options.dir.weex.android,
          encoding: 'utf8',
        },
        (error: childProcess.ExecException | null, stdout: string, stderr: string) => {
          error ? reject(error) : resolve()
          error ? logger.error(stderr) : logger.info(stdout)
        })
    })
  }
}

export default Bundler
