import { Builder, BuildModule } from '@etsx/builder'
import pify from 'pify'
import glob from 'glob'
import path from 'path'
import webpack from 'webpack'
import webpackDevMiddleware from 'webpack-dev-middleware'
import webpackHotMiddleware from 'webpack-hot-middleware'
import WeexJsbundleHotMiddleware from './plugins/weex-jsbundle-hot'
import { logger, parallel, sequence, wrapArray } from '@etsx/utils'
import {
  ClientWebpackConfig,
  ModernWebpackConfig,
  ServerWebpackConfig,
  WeexWebpackConfig,
  // PerfLoader,
} from './config'

export class Bundler extends BuildModule {
  builder: Builder;
  compilers: Set<webpack.Compiler>;
  compilersWatching: Map<webpack.Compiler, webpack.Compiler.Watching>;
  constructor(builder: Builder) {
    super(builder.etsx);
    // 构建器
    this.builder = builder
    // 构建集合
    this.compilers = new Set()
    // 构建的监视集合
    this.compilersWatching = new Map()

    this.build = this.build.bind(this)
    this.unwatch = this.unwatch.bind(this)
    this.close = this.close.bind(this)
  }
  async build() {
    type name = 'weex' | 'modern' | 'client' | 'server';
    // 编译器配置集合
    const compilersOptions: Map<name, webpack.Configuration> = new Map()

    // 开启浏览器模式
    if (this.isEnableBrowser) {
      // 现代浏览器 - Modern
      if (this.options.modern) {
        compilersOptions.set('modern', new ModernWebpackConfig(this.etsx))
      }
      // 古老浏览器 - Client
      compilersOptions.set('client', new ClientWebpackConfig(this.etsx))
      // 服务器渲染 - Server
      compilersOptions.set('server', new ServerWebpackConfig(this.etsx))
    }
    // 手机应用 - weex - Rax - android|ios
    if (this.isEnableWeex) {
      compilersOptions.set('weex', new WeexWebpackConfig(this.etsx))
    }
    for (const p of this.builder.plugins) {
      compilersOptions.forEach((options, name) => {
        let isHas = false
        options.name = name
        switch (name) {
          // 古老浏览器 + 现代浏览器
          case 'client':
          case 'modern':
            isHas = (p.web !== false || p.wap !== false)
            break;
          // 服务器渲染
          case 'server':
            isHas = p.ssr !== false
            break;
          // ios + android
          case 'weex':
            isHas = (p.ios !== false || p.android !== false)
            break;
        }
        if (p.name && options.resolve && options.resolve.alias && !options.resolve.alias[p.name]) {
          options.resolve.alias[p.name] = isHas ? p.src : './empty.js'
        }
      })
    }
    // 配置编译器
    compilersOptions.forEach((compilersOption) => {
      this.compilers.add(webpack(compilersOption))
    })
    // 判断当前使用并行构建还是队列构建
    const runner = this.options.dev ? parallel : sequence
    // 开始构建
    await runner(Array.from(this.compilers), (compiler) => {
      // 开始构建
      return this.webpackCompile(compiler)
    })
  };
  async webpackCompile(compiler: webpack.Compiler): Promise<void> {
    const name = compiler.options.name
    if (!name) {
      throw new Error('没有传入name');
    }
    // 触发钩子:开始构建
    await this.etsx.callHook('bundler-tsx:compile', { name, compiler })

    // 构建完毕，加载渲染器资源
    compiler.hooks.done.tap('load-resources', async (stats) => {
        //  触发钩子:构建完毕
      await this.etsx.callHook('bundler-tsx:compiled', {
        name,
        compiler,
        stats,
      })

      // 因为已经构建完毕，需要重新加载渲染器（如果可用）
      await this.etsx.callHook('build:resources', this.mfs || this.lfs)
    })
    // 指定监听的文件系统
    compiler.watchFileSystem = this.watchFileSystem
    // 输入文件系统使用本地文件系统
    compiler.inputFileSystem = this.lfs
    // 输出文件系统使用本地文件系统
    compiler.outputFileSystem = this.lfs

    if (this.options.dev) {
      await new Promise((resolve, reject) => {
        compiler.hooks.done.tap('etsx-dev', () => resolve())
        // --- 开发模式构建 ---
        if (['client', 'modern'].includes(name)) {
          // 输出文件系统使用内存文件系统
          compiler.outputFileSystem = this.mfs
          // 浏览器-客户端构建，监视由 webpackDevForBrowser 启动
          this.addHotForBrowser(compiler)
          this.webpackDev(compiler, 'browser')
        } else if (name === 'weex') {
          // 输出文件系统使用内存文件系统
          compiler.outputFileSystem = this.mfs
          // weex-app客户端构建， 监视由 webpackDevForWeex 启动
          this.addHotForWeex(compiler)
          this.webpackDev(compiler, 'weex')

        } else {
          // 服务器渲染 - 各大小程序 构建和监视修改，直接这里启动
          this.compilersWatching.set(
            compiler,
            compiler.watch(
              this.buildOptions.browser.watchers,
              (err) => err ? reject(err) : resolve(),
            ))
        }
      })
    } else {
      // --- Production Build ---
      const stats = await new Promise<webpack.Stats>((resolve, reject) => compiler.run((err, stats) => err ? reject(err) : resolve(stats)))

      if (stats.hasErrors()) {
        if (this.buildOptions.quiet === true) {
          return Promise.reject(stats.toString(this.buildOptions.stats))
        } else {
          // Actual error will be printed by webpack
          throw new Error('Etsx Build Error')
        }
      }

    }
  }
  addHotForWeex(compiler: webpack.Compiler) {
    logger.debug('Adding webpack dev middleware for weex...')

    const name = compiler.options.name
    if (!name) {
      throw new Error('没有传入name');
    }

    const weexJsbundleHot = new WeexJsbundleHotMiddleware(compiler, {
      path: '/__weex_hot_reload_server',
      publicPath: `${this.etsx.options._publicPath}weex/`,
    })

    this.hotMiddleware.set(name, Object.assign(pify(weexJsbundleHot), {
      close: weexJsbundleHot.close,
    }));
  }
  addHotForBrowser(compiler: webpack.Compiler) {
    logger.debug('Adding webpack dev middleware for browser...')
    const name = compiler.options.name
    if (!name) {
      throw new Error('没有传入name');
    }

    this.devMiddleware.set(name, pify(
      webpackHotMiddleware(
        compiler,
        Object.assign(
          {
            log: false,
            heartbeat: 10000,
          },
          this.browserOptions.hotMiddleware,
          {
            path: `/__webpack_hmr/${name}`,
          },
        ),
      )),
    );
  }
  webpackDev(compiler: webpack.Compiler, terminal: 'browser' | 'weex') {
    const name = compiler.options.name
    if (!name) {
      throw new Error('没有传入name');
    }
    logger.debug(`Adding webpack dev middleware for ${compiler.options.name}...`)
    // 创建webpack dev中间件
    // pify 会加一个callback作为 中间件的 next 使得实现了 永远会成功的承诺
    const publicPath = `${this.etsx.options._publicPath}${terminal}/`
    const devMiddleware = webpackDevMiddleware(
      compiler,
      Object.assign(
        {
          publicPath,
          stats: false,
          logLevel: 'silent',
          watchOptions: this.buildOptions[terminal].watchers,
        },
        this.buildOptions[terminal].devMiddleware,
      ),
    )
    this.devMiddleware.set(name, Object.assign(pify(devMiddleware), {
      close: pify(devMiddleware.close.bind(devMiddleware)),
    }));
  }
  async unwatch() {
    const promises: Array<Promise<any>> = []
    // 关闭所有webpack的构建文件变化监视
    if (this.compilersWatching) {
      // 关闭某一个循环的文件变化监视
      promises.push(...Array.from(this.compilersWatching.values()).map((m) => m.close && pify(m.close)()))
      this.compilersWatching.clear()
    }
    // 停止所有的webpack中间件
    if (this.devMiddleware) {
      // 关闭某一个循环的webpack中间件
      promises.push(...Array.from(this.devMiddleware.values()).map((m) => m.close ? m.close() : Promise.resolve()))
      this.devMiddleware.clear()
    }
    // 停止所有的webpack中间件
    if (this.hotMiddleware) {
      // 关闭某一个循环的webpack中间件
      promises.push(...Array.from(this.hotMiddleware.values()).map((m) => m.close ? m.close() : Promise.resolve()))
      this.hotMiddleware.clear()
    }

    await Promise.all(promises)
  };
  async close() {

  }
  /**
   * 开发-热缓存模块-中间件
   */
  get devMiddleware() {
    return this.server.devMiddleware;
  }
  /**
   * 开发-热渲染模块-中间件
   */
  get hotMiddleware() {
    return this.server.hotMiddleware;
  }
  get server() {
    return this.etsx.server;
  }
}

export default Bundler
