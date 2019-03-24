import {r} from '@etsx/utils'
import Builder from './builder'

export function getBuildDirs(builder: Builder): string[] {

  // 创建 .etsx/app 文件夹
  const buildDirs = [r(builder.options.dir.build, 'app')]

  /**
   * 启用 浏览器模式
   */
  if (builder.isEnableBrowser) {
    buildDirs.push(
      /**
       * 创建 .etsx/app/browser/client/components 文件夹
       * 用于客户端的组件
       */
      r(builder.options.dir.build, 'app', 'browser', 'client', 'components'),
      /**
       * 创建 .etsx/app/browser/server/components 文件夹
       * 用于服务端的组件
       */
      r(builder.options.dir.build, 'app', 'browser', 'server', 'components'),
    )
    if (!builder.options.dev) {
      /**
       * 调试模式需要导出目录
       */
      buildDirs.push(
        r(builder.options.dir.build, 'dist', 'browser', 'client'),
        r(builder.options.dir.build, 'dist', 'browser', 'server'),
        // r(builder.options.dir.dist.browser),
      )
    }
  }
  /**
   * 启用 weex
   */
  if (builder.isEnableWeex) {
    buildDirs.push(
      r(builder.options.dir.build, 'app', 'weex'),
      r(builder.options.dir.dist.weex),
    )
  }
  if (builder.isEnableMpWechat) {
    buildDirs.push(
      r(builder.options.dir.build, 'app', 'wechat'),
      r(builder.options.dir.dist.wechat),
    )
  }
  if (builder.isEnableMpBaidu) {
    buildDirs.push(
      r(builder.options.dir.build, 'app', 'baidu'),
      r(builder.options.dir.dist.baidu),
    )
  }
  if (builder.isEnableMpAlipay) {
    buildDirs.push(
      r(builder.options.dir.build, 'app', 'alipay'),
      r(builder.options.dir.dist.alipay),
    )
  }
  return buildDirs
}
export default getBuildDirs
