import path from 'path'
import { getOptions, defaultsDeepClone } from '@etsx/utils'
export type weex = {
  /**
   * ios目录
   */
  ios: string;
  /**
   * android目录
   */
  android: string;
};

export function weex(options: getOptions<weex>, root: string): weex {
  const weex = defaultsDeepClone<weex>(options, {
    ios: 'platforms/ios',
    android: 'platforms/android',
  })
  weex.ios = path.resolve(root, weex.ios)
  weex.android = path.resolve(root, weex.android)
  return weex
}
export default weex
