import path from 'path';
import Etsx, { EtsxModule } from 'etsx'
import crypto from 'crypto';
import invert from 'lodash/invert';
import { sleep, logger, devalue } from '@etsx/utils';
import Server from '@etsx/server'
import fs from 'graceful-fs';
import { TemplateExecutor } from 'lodash';
import { createBundleRunner, files, entry, userContext, runInNewContext } from './create-bundle-runner'
import { createMapper } from './create-async-file-mapper'
import { createSourceMapConsumers, rewriteErrorTrace, mapConsumers, rawMaps } from './source-map-support'
import loadResources from './load-resources'
import { parseTemplate } from './utils'

// const { createBundleRenderer } = require('vue-server-renderer')

type frameworkRenderer = (App: any, props: any) => string | Promise<string>;
type frameworks = { [framework: string]: frameworkRenderer };
type getFrameworks = { [framework: string]: (etsx?: Etsx) => frameworkRenderer };

export type browserManifest = {
  publicPath: string;
  all: string[];
  initial: string[];
  async: string[];
  modules: {
    [identifier: string]: number[];
  };
  assetsMapping: {
    [name: string]: string;
  };
}
export type serverManifest = {
  entry: entry;
  files: files;
  maps: {
    [fileName: string]: string;
    // [fileName: string]: RawSourceMap;
  };
};

type readResource = (fileName: string, isMFS: boolean, encoding?: string) => string | Buffer;

export type resources = {
  clientManifest?: browserManifest;
  modernManifest?: browserManifest;
  serverManifest?: serverManifest;
  errorTemplate?: TemplateExecutor;
}
export type runEtsxServer = <R>(context: userContext, render: (res: any) => R | Promise<R>) => Promise<R>

export class Renderer extends EtsxModule {
  resources: resources;
  frameworks: frameworks;
  getFrameworks: getFrameworks;
  runEtsxServer?: runEtsxServer;
  _assetsMapping?: {};
  renderer: {
    ssr?: any,
    modern?: any,
    spa?: any,
  };
  constructor(etsx: Etsx) {
    super(etsx)

    /**
     * 将由createRenderer设置
     */
    this.renderer = {
      ssr: void 0,
      modern: void 0,
      spa: void 0,
    }
    // Renderer runtime resources
    /**
     * 运行时共享资源
     * 渲染器运行时资源
     */
    this.resources = {
      clientManifest: void 0,
      modernManifest: void 0,
      serverManifest: void 0,
      errorTemplate: parseTemplate('etsx Internal Server Error'),
    }

    this.frameworks = {}
    this.getFrameworks = {}
    this.renderRoute = this.renderRoute.bind(this)
    this.loadResources = this.loadResources.bind(this)
    this.getFrameworkRenderer = this.getFrameworkRenderer.bind(this)
  }

  async renderRoute(url: string, context: userContext = {}): Promise<any> {
    /* istanbul ignore if */
    if (!this.isReady) {
      await sleep(1000)
      return this.renderRoute(url, context)
    }

    try {
      context = { xx: 4, isWap: false }
      context.loadedAsync = new Set()
      const html = await this.renderer.ssr(context)

      return { html }
    } catch (error) {
      // console.log(error)
    }

    // Log rendered url
    logger.debug(`Rendering url ${url}`)
    return;

    // Add url and isSever to the context
    context.url = url

    // Basic response if SSR is disabled or spa data provided
    const { req, res } = context
    const spa = context.spa || (res && res.spa)
    const ENV = this.context.options.env

    if (this.noSSR || spa) {
      const {
        HTML_ATTRS,
        BODY_ATTRS,
        HEAD,
        BODY_SCRIPTS,
        getPreloadFiles,
      } = await this.renderer.spa.render(context)
      const APP =
        `<div id="${this.context.globals.id}">${this.context.resources.loadingHTML}</div>` + BODY_SCRIPTS

      const html = this.renderTemplate(false, {
        HTML_ATTRS,
        BODY_ATTRS,
        HEAD,
        APP,
        ENV,
      })

      return { html, getPreloadFiles }
    }

    let APP
    // Call renderToString from the bundleRenderer and generate the HTML (will update the context as well)
    if (req && req.modernMode) {
      APP = await this.renderer.modern.renderToString(context)
    } else {
      APP = await this.renderer.ssr.renderToString(context)
    }

    if (!context.nuxt.serverRendered) {
      APP = `<div id="${this.context.globals.id}"></div>`
    }
    const m = context.meta.inject()
    let HEAD =
      m.title.text() +
      m.meta.text() +
      m.link.text() +
      m.style.text() +
      m.script.text() +
      m.noscript.text()
    if (this.context.options._routerBaseSpecified) {
      HEAD += `<base href="${this.context.options.router.base}">`
    }

    if (this.context.options.render.resourceHints) {
      HEAD += this.renderResourceHints(context)
    }

    await this.context.nuxt.callHook('render:routeContext', context.nuxt)

    const serializedSession = `window.${this.context.globals.context}=${devalue(context.nuxt)};`

    const cspScriptSrcHashSet = new Set()
    if (this.context.options.render.csp) {
      const { hashAlgorithm } = this.context.options.render.csp
      const hash = crypto.createHash(hashAlgorithm)
      hash.update(serializedSession)
      cspScriptSrcHashSet.add(`'${hashAlgorithm}-${hash.digest('base64')}'`)
    }

    APP += `<script>${serializedSession}</script>`
    APP += this.renderScripts(context)
    APP += m.script.text({ body: true })
    APP += m.noscript.text({ body: true })

    HEAD += context.renderStyles()

    const html = this.renderTemplate(true, {
      HTML_ATTRS: 'data-n-head-ssr ' + m.htmlAttrs.text(),
      BODY_ATTRS: m.bodyAttrs.text(),
      HEAD,
      APP,
      ENV,
    })

    return {
      html,
      cspScriptSrcHashSet,
      getPreloadFiles: context.getPreloadFiles,
      error: context.nuxt.error,
      redirected: context.redirected,
    }
  }
  async getFrameworkRenderer(framework: string) {
    if (!this.frameworks[framework]) {
      if (!this.frameworks[framework] || typeof this.frameworks[framework] !== 'function') {
        throw new Error('get framework renderer fail');
      }
      this.frameworks[framework] = await this.getFrameworks[framework](this.etsx)
    }
    return this.frameworks[framework]
  }
  async createEtsxServerRunner(runInNewContext: runInNewContext = false) {
    if (!this.resources.serverManifest) {
      throw new Error('not find resources serverManifest');
    }
    const hasModules = fs.existsSync(path.resolve(this.options.dir.root, 'node_modules'))
    const { entry, files, maps } = this.resources.serverManifest
    const rawMaps: rawMaps = {}
    // Try to parse sourcemaps
    for (const file in maps) {
      if (typeof maps[file] === 'string' || Buffer.isBuffer(maps[file])) {
        try {
          rawMaps[file] = JSON.parse(maps[file])
        } catch (e) {
          rawMaps[file] = { file, version: '3', sources: [], sourcesContent: [], mappings: '', sourceRoot: '', names: [] }
        }
      }
    }
    const mapcs: mapConsumers = createSourceMapConsumers(rawMaps)
    const run = createBundleRunner(
      entry,
      files,
      // 对于全局安装的etsx命令，搜索全局目录中的依赖项
      hasModules ? this.options.dir.root : process.cwd(),
      runInNewContext,
    )
    this.runEtsxServer = (context: userContext, render: (res: any) => any) => run(context).then((res) => {
      return Promise.resolve()
        .then(() => typeof render === 'function' ? render(res) : res)
        .catch((err: Error) => {
          rewriteErrorTrace(err, mapcs)
          return Promise.reject(err)
        })
    }, (err: Error) => {
      rewriteErrorTrace(err, mapcs)
      return Promise.reject(err)
    })
  }
  async getHtmlByHeadMain(head: string, main: string, etsxScripts: string): Promise<string> {
    const html = `<!DOCTYPE html>
<html>
${head}
<body>
<div id="__etsx">${main}</div>
${etsxScripts}
</body>
</html>`
    return html;
  }
  createBundleRenderer(browserManifest: browserManifest) {
    const frameworks = this.etsx.resolver.requireModule(path.resolve(this.options.dir.build, 'framework/render-ssr.js'))

    const publicPath = browserManifest.publicPath || this.options.publicPath
    const initial = Array.isArray(browserManifest.initial) ? browserManifest.initial : []

    const mapper = createMapper(browserManifest)

    const etsxScript = initial.map((fileName) => {
      return `<script src="${publicPath}${fileName}" defer></script>`
    }).join('\n')

    const getAsyncEtsxScript = (loadedAsync: string[]): string => mapper(loadedAsync).map((fileName) => {
      return `<script src="${publicPath}${fileName}" defer></script>`
    }).join('\n')

    return (context?: userContext): Promise<string> => {
      context = context || {}
      if (!(context.loadedAsync instanceof Set)) {
        context.loadedAsync = new Set()
      }
      if (!this.runEtsxServer) {
        return Promise.reject(new Error('not find etsx bundle server renderer'))
      }
      return this.runEtsxServer(context, ({ Head, Main, mainFramework, headFramework }: any): Promise<string> => {
        if (!Head) {
          return Promise.reject(new Error('not Head'))
        }
        if (!Main) {
          return Promise.reject(new Error('not Main'))
        }
        return Promise.resolve()
          .then(() => frameworks[mainFramework]()(Main, context))
          .then((res) => Promise.all([res, frameworks[headFramework]()(Head, context)]))
          .then(([main, head]) => this.getHtmlByHeadMain(head, main, etsxScript + getAsyncEtsxScript(context.loadedAsync)))
      })
    }
  }
  async createRenderer() {
    // 不创建新的上下文
    this.createEtsxServerRunner(false);
    this.getFrameworks = this.etsx.resolver.requireModule(path.resolve(this.options.dir.build, 'framework/render-ssr.js'))

    if (!this.resources.clientManifest) {
      throw new Error('not find resources clientManifest');
    }

    // Create bundle renderer for SSR
    this.renderer.ssr = this.createBundleRenderer(this.resources.clientManifest)

    if (this.options.modern === 'server') {
      if (!this.resources.modernManifest) {
        throw new Error('not find resources modernManifest');
      }
      this.renderer.modern = this.createBundleRenderer(this.resources.modernManifest)
    }
  }

  async loadResources(fs: any) {
    return await loadResources(this, this.resources, fs)
  }
  async ready() {
    // 绑定加载资源钩子
    this.etsx.hook('build:resources', async (fs: any) => {
      if (this.options.dev && this._assetsMapping) {
        delete this._assetsMapping
      }
      await this.loadResources(fs)
    })
    // -- 开发模块 --
    if (this.options.dev) {
      // 开发模式下，不进行错误判断
      return
    }
    // -- 产品模式 --

    // 尝试从fs加载SSR资源
    await this.loadResources(fs)

    // Verify resources
    if (this.options.modern && !this.resources.modernManifest) {
      throw new Error(
        'No modern build files found. Use either `etsx build --modern` or `modern` option to build modern files.',
      )
    }
  }
  get isReady() {
    // Required for both
    /* istanbul ignore if */
    if (!this.resources.clientManifest) {
      return false
    }
    if (this.options.modern && !this.resources.modernManifest) {
      return false
    }
    return true
  }
  get assetsMapping() {
    if (this._assetsMapping) {
      return this._assetsMapping
    }
    if (!this.resources.clientManifest || !this.resources.modernManifest) {
      return {}
    }
    const legacyAssets = this.resources.clientManifest.assetsMapping
    const modernAssets = invert(this.resources.modernManifest.assetsMapping)
    const mapping: { [x: string]: string; } = {};
    Object.keys(legacyAssets).forEach((legacyJsFile) => {
      const chunkNamesHash = legacyAssets[legacyJsFile]
      mapping[legacyJsFile] = modernAssets[chunkNamesHash]
    })
    delete this.resources.clientManifest.assetsMapping
    delete this.resources.modernManifest.assetsMapping
    this._assetsMapping = mapping
    return mapping
  }
}
export default Renderer
