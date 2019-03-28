import Etsx from 'etsx';
import path from 'path';
import BuildContext from './context'
import OptionsWebpackConfig from './options';
import WeexJsbundleFrameworkComment from '../plugins/weex-jsbundle';

export class WeexWebpackConfig extends OptionsWebpackConfig {
  public constructor(etsx: Etsx) {
    const context = new BuildContext(etsx, 'weex')
    super(context)
    const { options: { dir } } = context
    // 编译为类 Node.js 环境可用（使用 Node.js require 加载 chunk）
    this.target = 'node'
    // 配置名称，加载多个配置时使用。
    this.name = 'weex'

    // 加入一个入口文件
    this.entry = {
      index: [
        path.resolve(dir.build, 'weex.tsx'),
      ],
    }
    this.optimization = {
      splitChunks: false,
      minimizer: [],
    }
    // 添加扩展名
    this.pushResolveExtensions('.js', '.jsx', '.json', 'mjs', 'ts', 'tsx', 'html', '.vue')
    // 添加模块加载规则
    // 样式规则
    this.module.rules.push({
      test: /\.css$/,
      include: dir.src,
      use: [
        {
          loader: 'stylesheet-loader',
        },
        {
          loader: 'weex-style-loader',
        },
      ],
    })
    /**
     * 使用image-source-loader为Image加载内联图像
     */
    this.module.rules.push({
      test: /\.(png|jpe?g|gif)$/i,
      include: dir.src,
      use: [
        {
          loader: 'image-source-loader',
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
    // 添加插件
    this.plugins.push(new WeexJsbundleFrameworkComment())
  }
}

export default WeexWebpackConfig
