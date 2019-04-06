import path from 'path'
import pify from 'pify'
import Glob from 'glob'
import upath from 'upath'
import semver from 'semver'
import STATUS, { STATE } from './status'
import { Etsx, moduleContainer } from 'etsx'
import BuildModule from './build-module'
import BundlerTsx from '@etsx/bundler-tsx'
import BundlerIos from '@etsx/bundler-ios'
import BundlerAndroid from '@etsx/bundler-android'
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
  isIndexFileAndFolder,
  determineGlobals,
} from '@etsx/utils'

type watcher =
  // 项目[模板、状态管理、中间件、页面文件]关键文件
  'etsx' |
  // 项目[配置项配置的文件]观察系统
  'custom' |
  // 需要整个服务模块重启的观察
  'restart';

const glob: (pattern: string, options?: Glob.IOptions) => Promise<string[]> = pify(Glob)
const hash: (src: any) => string = require('hash-sum')

export const tsxStatus = Symbol('tsxStatus')
export const bundlerTsx = Symbol('bundlerTsx')
export const bundlerIos = Symbol('bundlerIos')
export const bundlerAndroid = Symbol('bundlerAndroid')

type template = {
  dir: string;
  files: string[];
  dependencies: {
    [key: string]: string;
  };
};
export class Builder extends BuildModule {
  template: template;
  [tsxStatus]: STATE;
  [bundlerTsx]?: BundlerTsx;
  [bundlerIos]?: BundlerIos;
  [bundlerAndroid]?: BundlerAndroid;
  plugins: moduleContainer.pluginObject[];
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
    // 插件
    this.plugins = []

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
        this.watchRestart()
      })

      // 在项目关闭的时候，进行停止观察
      this.etsx.hook('close', () => this.close())
    }
    if (this.buildOptions.analyze) {
      this.etsx.hook('build:done', () => {
        logger.warn('Notice: Please do not deploy bundles built with analyze mode, it\'s only for analyzing purpose.')
      })
    }
    const template = this.options.template || '@etsx/browser-weex-app'
    if (typeof template === 'string') {
      this.template = this.etsx.resolver.requireModule(template)
    } else {
      this.template = template
    }
  }
  async build(): Promise<this> {
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
      return this.build()
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

    // 开始浏览器-wap构建
    await this.validateWapPages()
    // 开始浏览器-web构建
    await this.validateWebPages()
    // 开始weex-jsbundle构建
    await this.validateWeexPages()

    // Validate template
    try {
      this.validateTemplate()
    } catch (err) {
      logger.fatal(err)
    }

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
    const buildDirs = [r(this.options.dir.build, 'dist')]
    /**
     * 启用 浏览器模式
     */
    if (this.isEnableBrowser) {
        /**
         * 调试模式需要导出目录
         */
        buildDirs.push(
          r(this.options.dir.build, 'dist', 'client'),
          r(this.options.dir.build, 'dist', 'server'),
          // r(builder.options.dir.dist.browser),
        )
    }
    await Promise.all(buildDirs.map((dir) => new Promise((resolve, reject) => {
      this.lfs.mkdirp(dir, (e) => e ? reject(e) : resolve())
    })))

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
  /**
   * weex-jsbundle构建
   */
  async validateWeexPages() {
    // tslint:disable-next-line:no-console
    console.log('validateWeexPages')
  }
  /**
   * 浏览器构建
   */
  async validateWebPages() {

  }
  async validateWapPages() {

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
    const etsxRestartWatch: string[] = [
      // Server middleware
      ...this.options.serverMiddleware.filter(isString) as string[],
      // Custom watchers
      ...this.options.watch as string[],
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

  validateTemplate() {
    if (!this.template) {
      throw new Error('template error');
    }
    if (!Array.isArray(this.template.files) || !this.template.files.length) {
      throw new Error('template files error');
    }
    // Validate template dependencies
    const dpendencyFixes: string[] = []
    if (this.template.dependencies) {
      Object.keys(this.template.dependencies).forEach((depName) => {
        const depVersion = this.template.dependencies[depName]
        const requiredVersion = `${depName}@${depVersion}`

        // Load installed version
        const pkg = this.etsx.resolver.requireModule(path.join(depName, 'package.json'))
        if (pkg) {
          const validVersion = semver.satisfies(pkg.version, depVersion)
          if (!validVersion) {
            logger.warn(`${requiredVersion} is required but ${depName}@${pkg.version} is installed!`)
            dpendencyFixes.push(requiredVersion)
          }
        } else {
          logger.warn(`${depName}@${depVersion} is required but not installed!`)
          dpendencyFixes.push(requiredVersion)
        }
      })
    }

    // Suggest dependency fixes (TODO: automate me)
    if (dpendencyFixes.length) {
      logger.error(
        `Please install missing dependencies:\n`,
        '\n',
        `Using yarn:\n`,
        `yarn add ${dpendencyFixes.join(' ')}\n`,
        '\n',
        `Using npm:\n`,
        `npm i ${dpendencyFixes.join(' ')}\n`,
      )
      throw new Error('Missing Template Dependencies')
    }
  }
  async generateRoutesAndFiles() {
    logger.debug(`Generating etsx files`)
    // Plugins
    this.plugins = Array.from(this.normalizePlugins())

    // -- Templates --
    const templatesFiles = Array.from(this.template.files)

    const aysncModules = (Array.isArray(this.buildOptions.aysncModules) ? this.buildOptions.aysncModules : []).concat(...Object.keys(this.options.frameworks).map((key) => this.options.frameworks[key].aysncModules))
    const renderToDoms = Object.keys(this.options.frameworks).map((key) => [key, this.options.frameworks[key].renderToDom])
    const getComponents = Object.keys(this.options.frameworks).map((key) => [key, this.options.frameworks[key].getComponent])
    const createElements = Object.keys(this.options.frameworks).map((key) => [key, this.options.frameworks[key].createElement])
    const templateVars = {
      options: this.options,
      extensions: this.options.extensions
        .map((ext) => ext.replace(/^\./, ''))
        .join('|'),
      // messages: this.options.messages,
      // splitChunks: this.options.build.splitChunks,
      uniqBy,
      isDev: this.options.dev,
      isTest: this.options.test,
      debug: this.options.debug,
      vue: { config: this.options.vue.config },
      // mode: this.buildOptions.mode,
      router: this.options.router,
      env: this.options.env,
      /*head: this.options.head,
      middleware: fsExtra.existsSync(path.join(this.options.srcDir, this.options.dir.middleware)),
      /*store: this.options.store,*/
      globalName: this.options.globalName,
      globals: determineGlobals(this.options.globalName, this.options.globals),
      css: this.options.css,
      aysncModules,
      renderToDoms,
      getComponents,
      createElements,
      wapFramework: this.buildOptions.browser.wapFramework,
      webFramework: this.buildOptions.browser.webFramework,
      bootFramework: this.buildOptions.browser.bootFramework,
      plugins: this.plugins,
      appPath: './App.js',
      ignorePrefix: this.options.ignorePrefix,
      layouts: Object.assign({}, this.options.layouts),
      /*loading:
        typeof this.options.loading === 'string'
          ? this.relativeToBuild(this.options.srcDir, this.options.loading)
          : this.options.loading,
      transition: this.options.transition,
      layoutTransition: this.options.layoutTransition,*/
      dir: this.options.dir,
      components: {
        ErrorPage: this.options.ErrorPage
          ? this.relativeToBuild(this.options.ErrorPage)
          : null,
      },
    }

    // // -- Layouts --
    // if (fsExtra.existsSync(path.resolve(this.options.srcDir, this.options.dir.layouts))) {
    //   const configLayouts = this.options.layouts
    //   const layoutsFiles = await glob(`${this.options.dir.layouts}/**/*.{${this.supportedExtensions.join(',')}}`, {
    //     cwd: this.options.srcDir,
    //     ignore: this.options.ignore,
    //   })
    //   layoutsFiles.forEach((file) => {
    //     const name = file
    //       .replace(new RegExp(`^${this.options.dir.layouts}/`), '')
    //       .replace(new RegExp(`\\.(${this.supportedExtensions.join('|')})$`), '')
    //     if (name === 'error') {
    //       if (!templateVars.components.ErrorPage) {
    //         templateVars.components.ErrorPage = this.relativeToBuild(
    //           this.options.srcDir,
    //           file,
    //         )
    //       }
    //       return
    //     }
    //     // Layout Priority: module.addLayout > .vue file > other extensions
    //     if (configLayouts[name]) {
    //       consola.warn(`Duplicate layout registration, "${name}" has been registered as "${configLayouts[name]}"`)
    //     } else if (!templateVars.layouts[name] || /\.vue$/.test(file)) {
    //       templateVars.layouts[name] = this.relativeToBuild(
    //         this.options.srcDir,
    //         file,
    //       )
    //     }
    //   })
    // }
    // // If no default layout, create its folder and add the default folder
    // if (!templateVars.layouts.default) {
    //   await fsExtra.mkdirp(r(this.options.buildDir, 'layouts'))
    //   templatesFiles.push('layouts/default.vue')
    //   templateVars.layouts.default = './layouts/default.vue'
    // }

    // // -- Routes --
    // consola.debug('Generating routes...')

    // if (this._defaultPage) {
    //   templateVars.router.routes = createRoutes(
    //     ['index.vue'],
    //     this.template.dir + '/pages',
    //     '',
    //     this.options.router.routeNameSplitter,
    //   )
    // } else if (this._nuxtPages) {
    //   // Use nuxt.js createRoutes bases on pages/
    //   const files = {};
    //   (await glob(`${this.options.dir.pages}/**/*.{${this.supportedExtensions.join(',')}}`, {
    //       cwd: this.options.srcDir,
    //       ignore: this.options.ignore,
    //     })).forEach((f) => {
    //       const key = f.replace(new RegExp(`\\.(${this.supportedExtensions.join('|')})$`), '')
    //       // .vue file takes precedence over other extensions
    //       if (/\.vue$/.test(f) || !files[key]) {
    //         files[key] = f.replace(/(['"])/g, '\\$1')
    //       }
    //     })
    //   templateVars.router.routes = createRoutes(
    //     Object.values(files),
    //     this.options.srcDir,
    //     this.options.dir.pages,
    //     this.options.router.routeNameSplitter,
    //   )
    // } else { // If user defined a custom method to create routes
    //   templateVars.router.routes = this.options.build.createRoutes(
    //     this.options.srcDir,
    //   )
    // }

    // await this.etsx.callHook(
    //   'build:extendRoutes',
    //   templateVars.router.routes,
    //   r,
    // )
    // // router.extendRoutes method
    // if (typeof this.options.router.extendRoutes === 'function') {
    //   // let the user extend the routes
    //   const extendedRoutes = this.options.router.extendRoutes(
    //     templateVars.router.routes,
    //     r,
    //   )
    //   // Only overwrite routes when something is returned for backwards compatibility
    //   if (extendedRoutes !== undefined) {
    //     templateVars.router.routes = extendedRoutes
    //   }
    // }

    // // Make routes accessible for other modules and webpack configs
    // this.routes = templateVars.router.routes

    // // -- Store --
    // // Add store if needed
    // if (this.options.store) {
    //   templatesFiles.push('store.js')
    // }

    // Resolve template files
    const customTemplateFiles = this.options.templates.map(
      (t) => (t && t.dst) || path.basename(typeof t === 'object' ? t.src : t),
    )
    type templates = Array<{
      src: string;
      dst: string;
      custom: boolean;
      options?: object;
    }>
    const templates: templates = templatesFiles
      .map((file) => {
        // Skip if custom file was already provided in options.templates[]
        // 如果options.templates[]中已提供自定义文件，请跳过
        if (customTemplateFiles.includes(file)) {
          return
        }
        // Allow override templates using a file with same name in ${srcDir}/app
        const customPath = r(this.options.dir.src, 'app', file)
        const customFileExists = this.lfs.existsSync(customPath)

        return {
          src: customFileExists ? customPath : r(this.template.dir, file),
          dst: file,
          custom: customFileExists,
        }
      })
      .filter(Boolean) as templates

    // -- Custom templates --
    // Add custom template files
    // 添加自定义模板文件
    templates.push(
      ...this.options.templates.map((t) => {
        return typeof t === 'string' ? {
          src: r(this.options.dir.src, t),
          dst: path.basename(t),
          custom: true,
        } : Object.assign(
          {
            src: r(this.options.dir.src, t.src),
            dst: t.dst || path.basename(t.src),
            custom: true,
          },
          t,
        )
      }),
    )

    // // -- Loading indicator --
    // if (this.options.loadingIndicator.name) {
    //   let indicatorPath = path.resolve(
    //     this.template.dir,
    //     'views/loading',
    //     this.options.loadingIndicator.name + '.html',
    //   )

    //   let customIndicator = false
    //   if (!fsExtra.existsSync(indicatorPath)) {
    //     indicatorPath = this.nuxt.resolver.resolveAlias(
    //       this.options.loadingIndicator.name,
    //     )

    //     if (fsExtra.existsSync(indicatorPath)) {
    //       customIndicator = true
    //     } else {
    //       indicatorPath = null
    //     }
    //   }

    //   if (indicatorPath) {
    //     templatesFiles.push({
    //       src: indicatorPath,
    //       dst: 'loading.html',
    //       custom: customIndicator,
    //       options: this.options.loadingIndicator,
    //     })
    //   } else {
    //     /* istanbul ignore next */
    //     // eslint-disable-next-line no-console
    //     logger.error(
    //       `Could not fetch loading indicator: ${
    //       this.options.loadingIndicator.name
    //       }`,
    //     )
    //   }
    // }

    await this.etsx.callHook('build:templates', {
      templatesFiles: templates,
      templateVars,
      resolve: r,
    })

    // Add vue-app template dir to watchers
    this.buildOptions.watch.push(this.template.dir)

    const templateOptions = this.templateOptions()
    // Interpret and move template files to .nuxt/
    await Promise.all(
      templates.map(async ({ src, dst, options, custom }) => {
        // Add custom templates to watcher
        if (custom) {
          this.buildOptions.watch.push(src)
        }

        // Render template to dst
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
          throw new Error(`Could not compile template ${src}: ${err.message}`)
        }
        // Ensure parent dir exits and write file
        // 确保父目录退出并写入文件
        await new Promise((resolve, reject) => {
          const file = r(this.options.dir.build, dst)
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

    logger.success('etsx files generated')
  }
  templateOptions() {
    // Prepare template options
    let lodash: any = null
    const templateOptions = {
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
    return templateOptions
  }

  normalizePlugins(): moduleContainer.pluginObject[] {
    return uniqBy(
      this.options.plugins.map((p): moduleContainer.pluginObject => {
        if (typeof p === 'string') {
          p = { src: p }
        }
        const pluginBaseName = path.basename(p.src, path.extname(p.src)).replace(
          /[^a-zA-Z?\d\s:]/g,
          '',
        )
        p.name = 'etsx_plugin_' + pluginBaseName + '_' + hash(p.src)
        p.src = this.etsx.resolver.resolveAlias(p.src)
        p.web = typeof p.web === 'undefined' ? true : p.web
        p.wap = typeof p.wap === 'undefined' ? true : p.wap
        p.ssr = typeof p.ssr === 'undefined' ? true : p.ssr
        p.ios = typeof p.ios === 'undefined' ? true : p.ios
        p.android = typeof p.android === 'undefined' ? true : p.android

        return p
      }),
      (p: moduleContainer.pluginObject): string => (p.name || ''),
    )
  }
  resolvePlugins() {
    // Check plugins exist then set alias to their real path
    return Promise.all(this.plugins.map(async (p) => {
      const ext = '{?(.+([^.])),/index.+([^.])}'
      const pluginFiles = await glob(`${p.src}${ext}`)

      if (!pluginFiles || pluginFiles.length === 0) {
        throw new Error(`Plugin not found: ${p.src}`)
      }

      if (pluginFiles.length > 1 && !isIndexFileAndFolder(pluginFiles)) {
        logger.warn({
          message: `Found ${pluginFiles.length} plugins that match the configuration, suggest to specify extension:`,
          additional: '\n' + pluginFiles.map((x) => `- ${x}`).join('\n'),
        })
      }

      p.src = this.relativeToBuild(p.src)
    }))
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
}
export default Builder
