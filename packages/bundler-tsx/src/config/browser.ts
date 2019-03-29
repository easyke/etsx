import path from 'path';
import OptionsWebpackConfig from './options';
import BuildContext from './context'

const createResolver = require('postcss-import-resolver')

export class BrowserWebpackConfig extends OptionsWebpackConfig {
  public constructor(context: BuildContext) {
    super(context)
    const { options: { dir } } = context
    // 编译为类 Node.js 环境可用（使用 Node.js require 加载 chunk）
    this.target = 'node'
    // 配置名称，加载多个配置时使用。

    // 加入一个入口文件
    this.entry = {
      index: [
        path.resolve(dir.build, 'app', 'weex', 'weex.js'),
      ],
    }
    // 添加扩展名
    this.pushResolveExtensions('.js', '.jsx', '.json', 'mjs', 'ts', 'tsx', 'html', '.vue')
    // 添加模块加载规则
    // 样式规则
    this.module.rules.push({
      test: /\.css$/,
      include: dir.src,
      exclude: /node_modules/,
      use: [
        // 'vue-style-loader',
        {
          loader: 'css-loader',
          options: {
            modules: true,
          },
        },
        {
          loader: 'postcss-loader',
          options: {
            sourceMap: true,
            plugins: [
              require('postcss-import')({
                resolve: createResolver({
                  alias: this.resolve.alias,
                  modules: this.resolve.modules,
                }),
              }),
              require('postcss-url')({}),
              require('postcss-salad')({
                browsers: ['last 3 versions'],
                features: {
                  autoprefixer: false,
                  bem: {
                    shortcuts: {
                      'component': 'b',
                      'modifier': 'm',
                      'descendent': 'e',
                      'utility': 'util',
                      'component-namespace': 'n',
                    },
                    separators: {
                      descendent: '__',
                      modifier: '--',
                    },
                  },
                },
              }),
              require('postcss-cssnext')({
                browsers: ['last 3 versions'],
              }),
              require('postcss-nested')({}),
            ],
          },
        },
      ],
    })
    /**
     * 使用图像
     */
    this.module.rules.push({
      test: /\.(png|jpg|gif|svg|eot|ttf|woff|woff2)$/,
      include: dir.src,
      exclude: /node_modules/,
      use: [
        {
          loader: 'url-loader',
          options: {
            limit: 10000,
          },
        },
      ],
    })
    this.module.rules.push({
      test: /\.(svg|eot|ttf|woff|woff2)$/,
      include: dir.src,
      exclude: /node_modules/,
      use: [
        {
          loader: 'url-loader',
          options: {
            limit: 10000,
          },
        },
      ],
    })
  }
}

export default BrowserWebpackConfig
