import Etsx from 'etsx';
import path from 'path';
import querystring from 'querystring';
import BuildContext from './context'
import BrowserWebpackConfig from './browser'

const es3ifyPlugin = require('es3ify-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

export class ClientWebpackConfig extends BrowserWebpackConfig {
  public constructor(etsx: Etsx, name: 'client' | 'modern' = 'client') {
    name = ['client', 'modern'].includes(name || '') ? name : 'client'
    const context = new BuildContext(etsx, name)
    super(context)
    const { options: { dir, dev: isDev, router }, browserOptions } = context
    // 编译为类 Node.js 环境可用（使用 Node.js require 加载 chunk）
    this.target = 'web'
    // 在 浏览器 渲染中使用了 node，需要虚拟node的环境
    this.node = false
    // 加入一个入口文件
    this.entry = {
      app: [
        path.resolve(dir.build, 'client.js'),
      ],
    }

    // 添加插件
    this.plugins.push(
      new es3ifyPlugin(),

      new HtmlWebpackPlugin({
        template: path.resolve(dir.build, 'app', 'index.html'),
        filename: 'index.html',
        inject: true,
      }),
      new HtmlWebpackPlugin({
        template: path.resolve(dir.build, 'app', 'index.html'),
        filename: 'index.html',
        inject: true,
      }),
      // 样式插件
      new MiniCssExtractPlugin({
        filename: isDev ? '[name].css' : '[name].[hash].css',
        chunkFilename: isDev ? '[id].css' : '[id].[hash].css',
      }),
    )
    // 添加模块热重载
    // 加载 模块热重载 配置
    const { client = {} } = browserOptions.hotMiddleware || {}
    const { ansiColors, overlayStyles, ...others } = client
    const hotMiddlewareClientOptions = {
      reload: true,
      timeout: 30000,
      ansiColors: JSON.stringify(ansiColors),
      overlayStyles: JSON.stringify(overlayStyles),
      ...others,
      name: this.name,
    }
    const clientPath = `${router.base}/__webpack_hmr/${this.name}`
    const hotMiddlewareClientOptionsStr =
      `${querystring.stringify(hotMiddlewareClientOptions)}&path=${clientPath}`.replace(/\/\//g, '/')

    // 添加热模块加载支持
    if (isDev) {
      this.entry.app.unshift(
        // https://github.com/webpack-contrib/webpack-hot-middleware/issues/53#issuecomment-162823945
        'eventsource-polyfill',
        // https://github.com/glenjamin/webpack-hot-middleware#config
        `webpack-hot-middleware/client?${hotMiddlewareClientOptionsStr}`,
      )
    }
  }
}

export default ClientWebpackConfig
