import path from 'path'
import { getOptions, defaultsDeepClone } from '@etsx/utils'
export type dist = {
  /**
   * 导出根目录
   */
  root: string;
  /**
   * ios的导出
   */
  ios: string;
  /**
   * android的导出
   */
  android: string;
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
    ios: 'ios',
    android: 'android',
    weex: 'weex',
    browser: 'browser',
  })
  dist.ios = path.resolve(dist.root, dist.ios)
  dist.android = path.resolve(dist.root, dist.android)
  dist.weex = path.resolve(dist.root, dist.weex)
  dist.browser = path.resolve(dist.root, dist.browser)
  return dist
}
export default dist
