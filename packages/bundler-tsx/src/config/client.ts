import Etsx from 'etsx';
import path from 'path';
import webpack from 'webpack';
import BuildContext from './context'
import BrowserWebpackConfig from './browser'
import BundleAnalyzer from 'webpack-bundle-analyzer'
import TerserWebpackPlugin from 'terser-webpack-plugin'
import OptimizeCSSAssetsPlugin from 'optimize-css-assets-webpack-plugin'
import ClientAssetManifestPlugin from '../plugins/etsx/client'

const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const es3ifyPlugin = require('es3ify-webpack-plugin')

export class ClientWebpackConfig extends BrowserWebpackConfig {
  public constructor(etsx: Etsx, name: 'client' | 'modern' = 'client') {
    name = ['client', 'modern'].includes(name || '') ? name : 'client'
    const context = new BuildContext(etsx, name)
    super(context)
    const { options: { dir, dev: isDev, router }, browserOptions, buildOptions, isModern } = context
    const app = [
      path.resolve(dir.build, 'client.js'),
    ]
    // 编译为类 Node.js 环境可用（使用 Node.js require 加载 chunk）
    this.target = 'web'
    // 在 浏览器 渲染中使用了 node，需要虚拟node的环境
    this.node = false
    // 加入一个入口文件
    this.entry = { app }
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

    if (!isModern) {
      // 转 es3 支持 ie
      this.plugins.push(new es3ifyPlugin())
      // UglifyJs3
      if (!Array.isArray(this.optimization.minimizer)) {
        this.optimization.minimizer = this.optimization.minimizer ? [this.optimization.minimizer] : []
      }
      this.optimization.minimizer.push(new UglifyJsPlugin({
        parallel: true,
        uglifyOptions: {
          ie8: true,
          output: {
            comments: false,
            beautify: false,
          },
          warnings: false,
        },
        sourceMap: true,
    }))
    }

    this.plugins.push(new ClientAssetManifestPlugin({
      filename: `../../server/${this.name}.manifest.json`,
    }))

    // 加载 模块热重载 配置
    // 添加热模块加载支持
    if (isDev) {
      app.unshift(
        // https://github.com/glenjamin/webpack-hot-middleware#config
        `webpack-hot-middleware/client?name=${this.name}&reload=true&timeout=30000&path=${
          router.base
          }/__webpack_hmr/${this.name}`.replace(/\/\//g, '/'),
      )
    }
  }
}

export default ClientWebpackConfig
