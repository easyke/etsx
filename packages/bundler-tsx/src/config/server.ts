import Etsx from 'etsx';
import path from 'path';
import BuildContext from './context'
import BrowserWebpackConfig from './browser'

export class ServerWebpackConfig extends BrowserWebpackConfig {
  public constructor(etsx: Etsx) {
    const context = new BuildContext(etsx, 'server')
    super(context)
    const { options: { dir } } = context
    // 编译为类 Node.js 环境可用（使用 Node.js require 加载 chunk）
    this.target = 'node'
    // 在node服务器渲染，不需要虚拟node的环境
    this.devtool = 'inline-cheap-module-source-map'
    // 在node服务器渲染，不需要虚拟node的环境
    this.node = false
    // 入口app为服务器文件
    // 加入一个入口文件
    this.entry = {
      app: [
        path.resolve(dir.build, 'app', 'server.js'),
      ],
    }
    this.output.filename = 'server-bundle.js'
    this.output.libraryTarget = 'commonjs2'
    this.optimization = {
      splitChunks: false,
      minimizer: [],
    }
    this.performance = {
      // 禁用打包大小限制
      hints: false,
      /**
       * 资源(asset)是从 webpack 生成的任何文件。
       * 此选项根据单个资源体积，控制 webpack 何时生成性能提示。
       * 默认值是：250000 (bytes)。
       */
      maxAssetSize: Infinity,
    }
  }
}

export default ServerWebpackConfig
