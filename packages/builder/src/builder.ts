import path from 'path'
import upath from 'upath'
import STATUS, { STATE } from './status'
import { Etsx } from 'etsx'
import BuildModule from './build-module'
import BundlerTsx from '@etsx/bundler-tsx'
import BundlerIos from '@etsx/bundler-ios'
import BundlerAndroid from '@etsx/bundler-android'
import getBuildDirs from './get-build-dirs'
import debounce from 'lodash/debounce'
import omit from 'lodash/omit'
import template from 'lodash/template'
import uniq from 'lodash/uniq'
import uniqBy from 'lodash/uniqBy'
import { FSWatcher } from 'chokidar';
import {
  r,
  wp,
  sleep,
  wChunk,
  logger,
  devalue,
  isString,
  serialize,
  relativeTo,
  stripWhitespace,
  serializeFunction,
} from '@etsx/utils'

type watcher =
  // 项目[模板、状态管理、中间件、页面文件]关键文件
  'etsx' |
  // 项目[配置项配置的文件]观察系统
  'custom' |
  // 需要整个服务模块重启的观察
  'restart';

const hash: (src: any) => string = require('hash-sum')

export const tsxStatus = Symbol('tsxStatus')
export const bundlerTsx = Symbol('bundlerTsx')
export const bundlerIos = Symbol('bundlerIos')
export const bundlerAndroid = Symbol('bundlerAndroid')
export const templateSymbol = Symbol('template')

export class Builder extends BuildModule {
  [tsxStatus]: STATE;
  [bundlerTsx]?: BundlerTsx;
  [bundlerIos]?: BundlerIos;
  [bundlerAndroid]?: BundlerAndroid;
  [templateSymbol]: Map<string, any>;
  // 初始化文件变化观察数组
  watchers: Map<watcher, FSWatcher>;
  supportedExtensions: string[];
  /**
   * 得到一个目录
   */
  relativeToBuild: (...args: string[]) => string;
  constructor(etsx: Etsx) {
    super(etsx)
    // 初始化文件变化观察数组
    this.watchers = new Map()

    this.supportedExtensions = ['js', 'jsx', 'ts', 'tsx']
    // Helper to resolve build paths
    this.relativeToBuild = (...args: string[]) =>
      relativeTo(this.options.dir.build, ...args)
    // 标记初始化状态
    this[tsxStatus] = STATUS.INITIAL

    // 绑定开发模式的生命周期
    if (this.options.dev) {
      // 在第一次编译完成的时候进行观察客户端文件变化
      this.etsx.hook('build:done', () => {
        logger.info('Waiting for file changes')
        this.watchEtsx()
      })

      // 在项目关闭的时候，进行停止观察
      this.etsx.hook('close', () => this.close())
    }
    if (this.buildOptions.analyze) {
      this.etsx.hook('build:done', () => {
        logger.warn('Notice: Please do not deploy bundles built with analyze mode, it\'s only for analyzing purpose.')
      })
    }
    // 解析模板
    this.templateResolve()
  }
  async build(): Promise<this> {
    await this.buildTsx()
    return this
  }
  async buildTsx(): Promise<this> {
    // 当在开发模式下，并且构建状态为完成的状态下，避免重新构建
    /* istanbul ignore if */
    if (this.tsxStatus === STATUS.BUILD_DONE && this.options.dev) {
      return this
    }
    // 如果在构建中，直接等待1000毫秒后，重新构建
    /* istanbul ignore if */
    if (this.tsxStatus === STATUS.BUILDING) {
      await sleep(1000)
      // 重新构建
      return this.buildTsx()
    }
    // 标记为构建完成
    this[tsxStatus] = STATUS.BUILDING
    // 如果是开发模式
    if (this.options.dev) {
      logger.info('准备项目进行开发')
      logger.info('初始构建可能需要一段时间')
    } else {
      logger.info('生产模式构建')
    }
    // 等待项目准备好了
    await this.etsx.ready()

    // 调用构建前钩子
    await this.etsx.callHook('build:before', this, this.buildOptions)

    // 删除整个构建目录
    await Promise.all([
      // 删除项目文件系统的 build文件夹
      new Promise((resolve, reject) => {
        this.lfs.remove(r(this.options.dir.build), (e) => e ? reject(e) : resolve())
      }),
      // 删除内存文件系统的 build文件夹
      new Promise((resolve, reject) => {
        this.mfs.remove(r(this.options.dir.build), (e) => e ? reject(e) : resolve())
      }),
    ])
    // 创建 .etsx/, .etsx/app and .etsx/dist 文件夹
    await Promise.all(getBuildDirs(this).map((dir) => new Promise((resolve, reject) => {
      this.lfs.mkdirp(dir, (e) => e ? reject(e) : resolve())
    })))

    // 开始浏览器构建
    await this.buildBrowser()
    // 开始weex-jsbundle构建
    await this.buildWeex()
    // 开始小程序构建
    await this.buildMiniprogram()
    // 打印日志
    logger.success('构建器初始化完毕')

    logger.debug(`应用的根目录: ${this.options.dir.src}`)

    // 生成 路由[routes] 文件并且解释 模板[template] 文件
    await this.generateRoutesAndFiles()

    await this.resolvePlugins()

    // 开始捆绑打包构建: webpack, rollup, parcel...
    await this.bundlerTsx.build()

    // 标记编译状态为完成 Flag to set that building is done
    this[tsxStatus] = STATUS.BUILD_DONE

    // 调用构建完成钩子
    await this.etsx.callHook('build:done', this)
    // 返回构建实例
    return this
  }
  async buildAndroid(): Promise<this> {
    await (new CliAndroid({
      weexHotReloadWs: this.weexHotReloadWs,
    })).run(this.etsx)
    return this
  }
  templateResolve() {
    // 启用 weex
    if (this.isEnableWeex) {
      this.template.set('weex', {
        // weex编译配置
        buildOptions: this.weexOptions,
        template: this.weexOptions.template || '@etsx/browser-weex-app',
      })
    }
    // 启用 浏览器
    if (this.isEnableBrowser) {
      this.template.set('browser', {
        // 浏览器编译配置
        buildOptions: this.browserOptions,
        template: this.browserOptions.template || '@etsx/browser-weex-app',
      })
    }

    this.template.forEach((item) => {
      if (typeof item.template === 'string') {
        const res = this.etsx.resolver.requireModule(item.template)
        item.template = res.template || res
      }
    })
  }
  /**
   * weex-jsbundle构建
   */
  async buildWeex() {
    // tslint:disable-next-line:no-console
    console.log(555557)
  }
  /**
   * 浏览器构建
   */
  async buildBrowser() {

    return
    // 检查页[pages]面目录是否存在，如果没有则发出警告
    this.isHasPages = typeof this.options.build.createRoutes !== 'function'
    if (this.isHasPages) {
      if (!fsExtra.existsSync(path.join(this.options.dir.src, this.options.dir.pages))) {
        const dir = this.options.dir.src
        if (fsExtra.existsSync(path.join(this.options.dir.src, '..', this.options.dir.pages))) {
          throw new Error(
            `No \`${this.options.dir.pages}\` directory found in ${dir}. Did you mean to run \`project\` in the parent (\`../\`) directory?`,
          )
        } else {
          this._defaultPage = true
          logger.warn(`No \`${this.options.dir.pages}\` directory found in ${dir}. Using the default built-in page.`)
        }
      }
    }
  }
  /**
   * 小程序构建
   */
  async buildMiniprogram() {

  }
  watchEtsx() {
    const src = this.options.dir.src
    const rGlob = (dir: string) => ['*', '**/*'].map((glob: string) => r(src, `${dir}/${glob}.{${this.supportedExtensions.join(',')}}`))
    const patterns: string[] = []
    /**
     * 插入的观察目录
     * @param ps 的观察目录数组
     */
    const push = (ps: string[]) => patterns.push.apply(patterns, ps)
    // 防抖动调用
    /* istanbul ignore next */
    const refreshFiles = debounce(() => this.generateRoutesAndFiles(), 200)

    if (this.isEnableBrowser) {
      push([
        r(this.options.dir.web.layouts),
        r(this.options.dir.web.store),
        r(this.options.dir.web.middleware),
      ])
      push(rGlob(this.options.dir.web.layouts))
      if (false/** 自动路由 */) {
        push([
          r(this.options.dir.web.pages),
          ...rGlob(this.options.dir.web.pages),
        ])
      }
    }
    if (this.isEnableBrowser || this.isEnableWeex) {
      push([
        r(this.options.dir.wap.layouts),
        r(this.options.dir.wap.store),
        r(this.options.dir.wap.middleware),
      ])
      push(rGlob(this.options.dir.wap.layouts))
      if (false/** 自动路由 */) {
        push([
          r(this.options.dir.wap.pages),
          ...rGlob(this.options.dir.wap.pages),
        ])
      }
    }
    /**
     * 本地构建，使用本地文件观察模块
     */
    // 项目[模板、状态管理、中间件、页面文件]关键文件
    this.watchers.set('etsx',
      this.chokidarWatch(
        patterns.map(upath.normalizeSafe),
        // 监听配置项
        this.buildOptions.chokidar,
      )
        // 仅仅在文件添加触发
        .on('add', refreshFiles)
        // 仅仅在文件删除触发
        .on('unlink', refreshFiles),
    )
    // 监听自定义
    this.watchCustom(refreshFiles)
  }
  /**
   * 观察整个项目文件
   * 如果使用的是远程管道构建，将不使用本地监听文件模块监听
   */
  watchCustom(refreshFiles: () => any, refresh: boolean = false) {
    /**
     * 自定义的观察目录
     */
    const customPatterns: string[] = []
    /**
     * 插入自定义的观察目录
     * @param ps 自定义的观察目录数组
     */
    const pushCustom = (ps: string[]) => customPatterns.push.apply(customPatterns, ps)

    pushCustom(this.buildOptions.watch)
    if (this.isEnableBrowser) {
      pushCustom(this.buildOptions.browser.watch)
      // 浏览器样式
      pushCustom(Object.values(omit(this.buildOptions.browser.styleResources, ['options'])))
    }
    if (this.isEnableWeex) {
      pushCustom(this.buildOptions.weex.watch)
    }
    if (this.isEnableMpWechat) {
      pushCustom(this.buildOptions.miniProgram.wechat.watch)
    }
    if (this.isEnableMpBaidu) {
      pushCustom(this.buildOptions.miniProgram.baidu.watch)
    }
    if (this.isEnableMpAlipay) {
      pushCustom(this.buildOptions.miniProgram.alipay.watch)
    }

    // 项目[配置项配置的文件]观察系统
    this.watchers.set('custom',
      this.chokidarWatch(
        uniq(customPatterns).map(upath.normalizeSafe),
        this.buildOptions.chokidar,
      )
        // 在文件变化触发
        .on('change', refreshFiles),
    )
  }
  watchRestart() {
    const etsxRestartWatch = [
      // Server middleware
      ...this.options.serverMiddleware.filter(isString),
      // Custom watchers
      ...this.options.watch,
    ].map(this.etsx.resolver.resolveAlias)
    this.watchers.set('restart',
      this
        .chokidarWatch(etsxRestartWatch, this.buildOptions.chokidar)
        .on('all', (event, _path) => {
          if (['add', 'change', 'unlink'].includes(event) === false) {
            return
          }
          this.etsx.callHook('watch:fileChanged', this, _path) // Legacy
          this.etsx.callHook('watch:restart', { event, path: _path })
        }),
    )
  }

  getTemplateOptions() {
    let lodash: any = null
    // 准备模板选项
    return {
      imports: {
        serialize,
        serializeFunction,
        devalue,
        hash,
        r,
        wp,
        wChunk,
        resolvePath: this.etsx.resolver.resolvePath,
        resolveAlias: this.etsx.resolver.resolveAlias,
        relativeToBuild: this.relativeToBuild,
        // Legacy support: https://github.com/nuxt/nuxt.js/issues/4350
        _: new Proxy({}, {
          get(target, prop) {
            if (!lodash) {
              logger.warn('Avoid using _ inside templates')
              lodash = require('lodash')
            }
            return lodash[prop]
          },
        }),
      },
      interpolate: /<%=([\s\S]+?)%>/g,
    }
  }
  async generateRoutesAndFiles() {
    const templateOptions = this.getTemplateOptions()
    const templateVars = {
      uniqBy,
      isDev: this.options.dev,
      isTest: this.options.test,
      debug: this.options.debug,
      middleware: false,
    }
    const promises: PromiseConstructor[] = []
    const appDir = path.resolve((this.options.dir.src || this.options.dir.root), 'app')
    this.template.forEach(({ template: { dir, files }, buildOptions }, name) => {
      files = Array.from(files)
      // 向观察者添加app模板目录
      this.buildOptions.watch.push(dir)
      // 解析模板文件
      const customTemplateFiles = buildOptions.templates.map(
        (t) => t.dst || path.basename(t.src || t),
      )

      files = files
        .map((file) => {
          // 如果build.templates[]中已提供自定义文件，则跳过
          if (customTemplateFiles.includes(file)) {
            return
          }
          // 允许使用 ${appDir}/${name} 中具有相同名称的文件覆盖模板
          const customPath = r(appDir, name, file)
          const customFileExists = this.lfs.existsSync(customPath)

          return {
            src: customFileExists ? customPath : r(dir, file),
            dst: file,
            custom: customFileExists,
          }
        })
        .filter(Boolean)

      // 将模板文件解释并移动到 .project/
      promises.push.apply(
        promises,
        files.map(async ({ src, dst, options, custom }) => {
          // 向观察者添加自定义模板, 因为不在app模板目录内
          if (custom) {
            this.buildOptions.watch.push(src)
          }
          // 将模板渲染到dst
          const fileContent = await new Promise<string>((resolve, reject) => this.lfs.readFile(src, 'utf8', (e, res) => e ? reject(e) : resolve(res)))
          let content: string
          try {
            const templateFunction = template(fileContent, templateOptions)
            content = stripWhitespace(
              templateFunction(
                Object.assign({}, templateVars, {
                  options: options || {},
                  custom,
                  src,
                  dst,
                }),
              ),
            )
          } catch (err) {
            /* istanbul ignore next */
            const e = new Error(`Could not compile template ${src}: ${err.message}`)
            if (err.stack && typeof err.stack === 'string') {
              e.stack += err.stack.substr(err.stack.indexOf('\n'))
            }
            throw e
          }
          // 确保父目录退出并写入文件
          await new Promise((resolve, reject) => {
            const file = r(this.options.dir.build, 'app', name, dst)
            this.lfs.mkdirp(path.dirname(file), (e) => {
              if (e) {
                reject(e)
              } else {
                this.lfs.writeFile(
                  // 写入路径
                  file,
                  // 写入内容
                  content,
                  // 写入格式
                  'utf8',
                  // 回调
                  (e) => e ? reject(e) : resolve(),
                )
              }
            })
          })
        }),
      )
      logger.success('Project files generated')
    })
    await Promise.all(promises)
  }

  resolvePlugins() {
  }
  /**
   * 获取构建捆绑生成器
   */
  getBundle<C extends any>(BundleBuilder: any, Bundle: C): C {
    // 如果已经是一个对象，直接返回
    if (typeof BundleBuilder === 'object') {
      return BundleBuilder
    }
    // 如果构建捆绑生成器是一个类或者构造函数
    if (typeof BundleBuilder === 'function') {
      return new (BundleBuilder as any)(this.etsx)
    }
    return new Bundle(this.etsx)
    //
  }
  /**
   * 解除观察文件变化
   */
  async unwatch() {
    // 如果存在，关闭整个文件观察体现
    this.watchers.forEach((watcher) => {
      if (typeof watcher.close === 'function') {
        watcher.close()
      }
    });
    this.watchers.clear()
    // 如果存在，关闭整个构建系统
    if (typeof this.bundlerTsx.unwatch === 'function') {
      await this.bundlerTsx.unwatch()
    }
  }
  async close() {
    if (this[tsxStatus] === STATUS.INITIAL) {
      return
    }
    // 标记初始化状态
    this[tsxStatus] = STATUS.INITIAL

    // Unwatch
    this.unwatch()

    // Close bundleTsx
    if (typeof this.bundlerTsx.close === 'function') {
      await this.bundlerTsx.close()
    }
  }
  get bundlerTsx(): BundlerTsx {
    if (!this[bundlerTsx]) {
      this[bundlerTsx] = new BundlerTsx(this)
    }
    return this[bundlerTsx] as BundlerTsx
  }
  get bundlerIos(): BundlerIos {
    if (!this[bundlerIos]) {
      this[bundlerIos] = new BundlerIos(this)
    }
    return this[bundlerIos] as BundlerIos
  }
  get bundlerAndroid(): BundlerAndroid {
    if (!this[bundlerAndroid]) {
      this[bundlerAndroid] = new BundlerAndroid(this)
    }
    return this[bundlerAndroid] as BundlerAndroid
  }
  get tsxStatus() {
    return this[tsxStatus]
  }
  get template() {
    if (!this[templateSymbol] || !(this[templateSymbol] instanceof Map)) {
      this[templateSymbol] = new Map()
    }
    return this[templateSymbol]
  }
}
export default Builder
