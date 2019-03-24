import Etsx, { EtsxModule, EtsxOptions } from 'etsx';
import BuildOptions, { buildOptions } from './options';

export class BuildModule extends EtsxModule {
  constructor(etsx: Etsx) {
    super(etsx);
  }
  /**
   * 编译总配置
   */
  get buildOptions(): BuildOptions {
    type o = EtsxOptions & { build: buildOptions };
    if (!(this.options as o).build && (this.options.$options as o).build) {
      (this.options as o).build = new BuildOptions((this.options.$options as o).build)
    }
    if (!(this.options as o).build) {
      throw new Error('Uncaught TypeError: Cannot read property \'build\' of undefined');
    }
    return (this.options as o).build as BuildOptions
  }
  /**
   * weex 配置
   */
  get weexOptions() {
    return this.buildOptions.weex
  }
  /**
   * 浏览器配置
   */
  get browserOptions() {
    return this.buildOptions.browser
  }
  /**
   * 小程序配置集合
   */
  get miniProgramOptions() {
    return this.buildOptions.miniProgram
  }
  /**
   * 微信小程序配置
   */
  get wechatMpOptions() {
    return this.miniProgramOptions.wechat
  }
  /**
   * 百度小程序配置
   */
  get baiduMpOptions() {
    return this.miniProgramOptions.baidu
  }
  /**
   * 支付宝小程序配置
   */
  get alipayMpOptions() {
    return this.miniProgramOptions.alipay
  }
  /**
   * 是否启用浏览器
   */
  get isEnableBrowser(): boolean {
    return this.browserOptions.enable === true
  }
  /**
   * 是否启用weex
   */
  get isEnableWeex(): boolean {
    return this.weexOptions.enable === true
  }
  /**
   * 是否启用微信小程序
   */
  get isEnableMpWechat(): boolean {
    return this.wechatMpOptions.enable === true
  }
  /**
   * 是否启用百度小程序
   */
  get isEnableMpBaidu(): boolean {
    return this.baiduMpOptions.enable === true
  }
  /**
   * 是否启用支付宝小程序
   */
  get isEnableMpAlipay(): boolean {
    return this.alipayMpOptions.enable === true
  }
  /**
   * 本地文件系统
   */
  get lfs() {
    return this.localFileSystem
  }
  /**
   * 临时用的内存文件系统
   */
  get mfs() {
    return this.memoryFileSystem
  }
  /**
   * 文件 监听系统
   */
  get chokidarWatch() {
    return this.buildOptions.chokidarWatch
  }
  /**
   * 监听文件系统
   */
  get watchFileSystem() {
    return this.buildOptions.watchFileSystem
  }
  /**
   * 本地文件系统
   */
  get localFileSystem() {
    return this.buildOptions.localFileSystem
  }
  /**
   * 临时用的内存文件系统
   */
  get memoryFileSystem() {
    return this.buildOptions.memoryFileSystem
  }
}
export default BuildModule
