import path from 'path'
import home from 'user-home'
import { logger, sequence, parallel } from '@etsx/utils'
import { installDep, findXcodeProject, xcodeProject, buildApp } from './utils'
import { Builder, BuildModule } from '@etsx/builder'
import { device, getIPhoneLists, runIosDevice } from './device'
import { isAvailable, installApp, launchApp, launch } from './simulator'

export const deviceLists = Symbol('deviceLists')

export class Bundler extends BuildModule {
  builder: Builder;
  isPodUpdate: boolean;
  deviceLists?: device[];
  xcodeProject?: xcodeProject;
  constructor(builder: Builder) {
    super(builder.etsx);
    this.builder = builder
    this.isPodUpdate = false
  }
  async build(input?: device | string | device[] | string[]) {
    if (!this.xcodeProject) {
      this.xcodeProject = await findXcodeProject(this.options.dir.weex.ios, this.lfs)
    }
    const xcodeProject = this.xcodeProject
    let devices: device[] = []
    // 开发模式 - 因为调试设备需要 选择设备
    if (this.options.dev) {
      logger.log(`获取选择的ios设备`)
      // 强制转数组
      if (input && !Array.isArray(input)) {
        input = [(input)] as device[] | string[]
      }
      if (!this.deviceLists || !Array.isArray(this.deviceLists)) {
        this.deviceLists = await getIPhoneLists()
      }
      // 过滤选择的设备，必须在列表内
      if (Array.isArray(input) && input.length) {
        input.forEach((device: device | string) => {
          devices.push(...(this.deviceLists as device[]).filter((t) => (typeof device === 'string' ? device : device.udid) === t.udid))
        })
      }
      // 没有任何选择的设备的时候提示选择
      if (!devices || !devices.length) {
        if (this.deviceLists.length > 1) {
          logger.log(`由于您没有传入选择的ios设备，自动选择了第一台设备[${this.deviceLists[0].name}]`)
          devices = [this.deviceLists[0]]
        }
      }
      devices.forEach((device) => logger.log(`选择了以下设备:${device.name} ios: ${device.version} ${device.isSimulator ? '(Simulator)' : ''}`))
    }
    logger.info(`start iOS app`)
    // 复制 jsBundle js资源
    await this.copyJsbundleAssets()
    if (this.isPodUpdate) {
      // 安装依赖
      await installDep(xcodeProject.path)
      // 一般更新一次就可以了
      this.isPodUpdate = false
    }
    // 最后一步
    if (this.options.dev) {
      // 获取真机列表
      const trueDevices = devices.filter((device) => !device.isSimulator)
      // 获取模拟器列表
      const simulatorDevices = devices.filter((device) => device.isSimulator)
      if (simulatorDevices.length) {
        // 构建模拟器的app
        await buildApp(xcodeProject, this.options.dev, simulatorDevices)
      }
      await parallel(simulatorDevices, async (device: device) => {
        // 开发模式需要运行app - 因为调试设备需要
        await this.runApp(xcodeProject, device, this.weexOptions.iosAppId)
      })
      if (trueDevices.length) {
        // 构建真机的app
        await buildApp(xcodeProject, this.options.dev, trueDevices)
      }
      await sequence(trueDevices, async (device: device) => {
        // 开发模式需要运行app - 因为调试设备需要
        await this.runApp(xcodeProject, device, this.weexOptions.iosAppId)
      })
    }
    if (!this.options.dev) {
      // 构建app
      await buildApp(xcodeProject)
      // 生产模式需要复制打包好的 apk 出来
      await this.copyReleaseAssets()
    }
  }
  /**
   * 复制 weex的Jsbundle
   */
  async copyJsbundleAssets(): Promise<void> {
    // const iosPath = this.xcodeProject.path
    // const bundlejsPath = path.join(iosPath, 'bundlejs')
    // console.log('ofs', this.ofs)
    // console.log('bundlejsPath', bundlejsPath)
    // throw new Error('4')
  }
  /**
   * 复制导出包到指定位置
   */
  async copyReleaseAssets(): Promise<void> {

  }
  /**
   * 在模拟器或设备上运行iOS应用程序
   * @param {Object} device
   * @param {Object} xcode project
   * @param {Object} options
   */
  async runApp(xcodeProject: xcodeProject, device: device, appId: string, iosBuildPath?: string): Promise<void> {
    const inferredSchemeName = path.basename(xcodeProject.name, path.extname(xcodeProject.name));
    const paths = [
      iosBuildPath,
      path.join(home, `Library/Developer/Xcode/DerivedData/Build/Products/Debug-iphonesimulator/${inferredSchemeName}.app`),
      path.join(xcodeProject.path, `build/Build/Products/Debug-iphonesimulator/${inferredSchemeName}.app`),
    ]
    for (const path of paths) {
      if (path && this.lfs.existsSync(path)) {
        iosBuildPath = path
        break
      }
    }
    if (!iosBuildPath || !this.lfs.existsSync(iosBuildPath)) {
      throw new Error(`You may had custome your XCode Deviced Data path, please use \`--iosBuildPath\` to set your path.`);
    }
    if (device.isSimulator) {
      // 在模拟器上运行iOS应用程序
      logger.info(`Run iOS Simulator..`);
      // 判断是否在iosBuildPath下的Info.plist存在CFBundleIdentifier这个key，并且有值
      /*childprocess.execFileSync(
        '/usr/libexec/PlistBuddy',
        ['-c', 'Print:CFBundleIdentifier', path.join(iosBuildPath, 'Info.plist')],
        { encoding: 'utf8' }
      ).trim();*/

      if (!await isAvailable(device)) {
        throw new Error('simulator is not available!');
      }

      logger.info(`Launching ${device.name}...`);
      // 启动模拟器总是以255失败，因为它需要更多的参数，但我们希望它只启动模拟器
      await launch(device)

      logger.info(`Installing ${iosBuildPath}`);
      // 在模拟器中安装app程序
      await installApp(iosBuildPath, device.udid)

      // 在模拟器中启动app程序
      await launchApp(appId, device.udid)
      logger.success('Success!');
    } else {
      logger.info(`Run iOS Device..`);
      // 在设备上运行iOS应用
      await runIosDevice(device.udid, iosBuildPath, this.options.dir.src)
      logger.info('Success!');
    }
  }
}

export default Bundler
