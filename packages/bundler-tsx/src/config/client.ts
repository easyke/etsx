import Etsx from 'etsx';
import path from 'path';
import webpack from 'webpack';
import querystring from 'querystring';
import BuildContext from './context'
import BrowserWebpackConfig from './browser'
import BundleAnalyzer from 'webpack-bundle-analyzer'
import TerserWebpackPlugin from 'terser-webpack-plugin'
import OptimizeCSSAssetsPlugin from 'optimize-css-assets-webpack-plugin'

const es3ifyPlugin = require('es3ify-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

export class ClientWebpackConfig extends BrowserWebpackConfig {
  public constructor(etsx: Etsx, name: 'client' | 'modern' = 'client') {
    name = ['client', 'modern'].includes(name || '') ? name : 'client'
    const context = new BuildContext(etsx, name)
    super(context)
    const { options: { dir, dev: isDev, router }, browserOptions, buildOptions, isModern } = context
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

    // Small, known and common modules which are usually used project-wise
    // Sum of them may not be more than 244 KiB

    if (
      buildOptions.splitChunks.commons === true &&
      this.optimization.splitChunks &&
      this.optimization.splitChunks.cacheGroups &&
      (this.optimization.splitChunks.cacheGroups as any).commons === undefined
    ) {
      (this.optimization.splitChunks.cacheGroups as any).commons = {
        test: /node_modules[\\/](rax|anujs|react|core-js|@babel\/runtime|axios|webpack|setimmediate|timers-browserify|process|regenerator-runtime|cookie|js-cookie|is-buffer|dotprop|etsx\.js)[\\/]/,
        chunks: 'all',
        priority: 10,
        name: true,
      }
    }

    // Add minimizer plugins
    if (this.optimization.minimize && this.optimization.minimizer === undefined) {
      this.optimization.minimizer = []

      // https://github.com/webpack-contrib/terser-webpack-plugin
      if (buildOptions.terser) {
        this.optimization.minimizer.push(
          new TerserWebpackPlugin(Object.assign({
            parallel: true,
            cache: buildOptions.cache,
            sourceMap: this.devtool === true ? false : (this.devtool && /source-?map/.test(this.devtool)),
            extractComments: {
              filename: 'LICENSES',
            },
            terserOptions: {
              compress: {
                ecma: isModern ? 6 : undefined,
              },
              output: {
                comments: /^\**!|@preserve|@license|@cc_on/,
              },
            },
          }, buildOptions.terser)),
        );
      }

      // https://github.com/NMFR/optimize-css-assets-webpack-plugin
      // https://github.com/webpack-contrib/mini-css-extract-plugin#minimizing-for-production
      // TODO: Remove OptimizeCSSAssetsPlugin when upgrading to webpack 5
      if (buildOptions.optimizeCSS) {
        this.optimization.minimizer.push(
          new OptimizeCSSAssetsPlugin(Object.assign({}, buildOptions.optimizeCSS)),
        );
      }
    }
    if (isDev) {
      // TODO: webpackHotUpdate is not defined: https://github.com/webpack/webpack/issues/6693
      this.plugins.push(new webpack.HotModuleReplacementPlugin())
    }

    // Webpack Bundle Analyzer
    // https://github.com/webpack-contrib/webpack-bundle-analyzer
    if (!isDev && buildOptions.analyze) {
      const statsDir = path.resolve(dir.build, 'stats')
      const options: BundleAnalyzer.BundleAnalyzerPlugin.Options = {
        analyzerMode: 'static',
        defaultSizes: 'gzip',
        generateStatsFile: true,
        openAnalyzer: !buildOptions.quiet,
        reportFilename: path.resolve(statsDir, `${this.name}.html`),
        statsFilename: path.resolve(statsDir, `${this.name}.json`),
      }
      if (typeof buildOptions.analyze === 'object') {
        Object.assign(options, buildOptions.analyze)
      }

      this.plugins.push(new BundleAnalyzer.BundleAnalyzerPlugin(options))
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
    const client = browserOptions.hotMiddlewareClient || {}
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
      this.entry.app = Array.isArray(this.entry.app) ? this.entry.app : [ this.entry.app ]
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
