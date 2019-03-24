import Etsx from './';
import { EtsxOptions } from './options';

export const etsx = Symbol('etsx')
export class EtsxModule {
  [etsx]: Etsx;
  constructor(ietsx: Etsx) {
    // 存储上下文
    this[etsx] = ietsx
  }
  get etsx(): Etsx {
    if (this[etsx]) {
      return this[etsx]
    } else {
      throw new Error('etsx error')
    }
  }
  get options(): EtsxOptions {
    if (this.etsx && this.etsx.options) {
      return this.etsx.options
    } else {
      throw new Error('etsx.options error')
    }
  }
  /**
   * 编译总配置
   */
  get buildOptions() {
    return this.options.build
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
}
export default EtsxModule
