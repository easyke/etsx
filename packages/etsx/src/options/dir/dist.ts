import path from 'path'
import { getOptions, defaultsDeepClone } from '@etsx/utils'
export type dist = {
  /**
   * 导出根目录
   */
  root: string;
  /**
   * 微信小程序的导出
   */
  wechat: string;
  /**
   * 支付宝小程序的导出
   */
  alipay: string;
  /**
   * 百度小程序的导出
   */
  baidu: string;
  /**
   * weex的导出
   */
  weex: string;
  /**
   * 导出静态的浏览器，纯静态的，目前不支持
   */
  browser: string;
};

export function dist(options: getOptions<dist>, root: string): dist {
  const dist = defaultsDeepClone<dist>(options, {
    // 导出根目录
    root: path.resolve(root, 'dist'),
    wechat: 'wechat',
    alipay: 'alipay',
    baidu: 'baidu',
    weex: 'weex',
    browser: 'browser',
  })
  dist.wechat = path.resolve(dist.root, dist.wechat)
  dist.alipay = path.resolve(dist.root, dist.alipay)
  dist.baidu = path.resolve(dist.root, dist.baidu)
  dist.weex = path.resolve(dist.root, dist.weex)
  dist.browser = path.resolve(dist.root, dist.browser)
  return dist
}
export default dist
