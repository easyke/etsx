import { stdEnv as env, defaultsDeepClone, getOptions } from '@etsx/utils'
import chokidar, { FSWatcher, WatchOptions } from 'chokidar';
import MFS from 'memory-fs';
import fs from 'graceful-fs';
import { cachedFileSystem } from '@etsx/fs';
import { proxy } from '@etsx/utils';
import WebpackDevMiddleware from 'webpack-dev-middleware';
import WebpackHotMiddleware from 'webpack-hot-middleware';
import HardSourcePlugin from 'hard-source-webpack-plugin'
import webpack from 'webpack';
import BundleAnalyzer from 'webpack-bundle-analyzer'
import TerserWebpackPlugin from 'terser-webpack-plugin'
import OptimizeCSSAssetsPlugin from 'optimize-css-assets-webpack-plugin'

export type watch = string
export type buildEnv = {
  /**
   * 开发模式
   */
  isDev: boolean;
  /**
   * 调试模式
   */
  isDebug: boolean;
  /**
   * 客户端
   */
  isClient: boolean;
  /**
   * 服务端
   */
  isServer: boolean;
  /**
   * 现代
   */
  isModern: boolean;
  /**
   * 构建weex
   */
  isWeex: boolean;
}
export type getFilenames = string | ((env: buildEnv) => string)
/**
 * 小程序构建配置项
 */
export type MiniProgram = {
};
/**
 * weex构建配置项
 */
export type Weex = {
  /**
   * 默认启用
   */
  enable: boolean;
  /**
   * ios AppId
   */
  iosAppId: string;
  /**
   * android AppId
   */
  androidAppId: string;
  /**
   * 您可以使用watch来监听文件更改。
   * 此功能特别适用用在modules中。
   * 类型: Array<String>
   */
  watch: watch[];
  /**
   * 插件
   */
  plugins: webpack.Plugin[];
  /**
   * 请查看 webpack-dev-middleware 了解更多可用选项。
   * 类型: Object
   */
  devMiddleware: WebpackDevMiddleware.Options;
};
/**
 * 浏览器 构建配置项
 */
export type Browser = {
  // 默认启用
  enable: boolean;
  /**
   * 您可以使用watch来监听文件更改。
   * 此功能特别适用用在modules中。
   * 类型: Array<String>
   */
  watch: watch[];
  styleResources: {};
  plugins: webpack.Plugin[];
  /**
   * 用于压缩在构建打包过程中创建的HTML文件配置html-minifier的插件（将应用于所有模式）。
   * 类型: Object
   */
  html: {
    // 临时不限制
    [key: string]: any;
  };
  /**
   * 请查看 webpack-dev-middleware 了解更多可用选项。
   * 类型: Object
   */
  devMiddleware: WebpackDevMiddleware.Options;
  /**
   * 请查看 webpack-hot-middleware 了解更多可用选项。
   * 类型: Object
   */
  hotMiddleware: WebpackHotMiddleware.Options;
  appTemplatePath?: string;
  loaders: {
    /**
     * file-loader#options
     * see: https://github.com/webpack-contrib/file-loader#options
     */
    file: {};
    /**
     * url-loader#options
     * see: https://github.com/webpack-contrib/url-loader#options
     */
    fontUrl: { limit: number };
    /**
     * url-loader#options
     * see: https://github.com/webpack-contrib/url-loader#options
     */
    imgUrl: { limit: number };
    css: {};
    cssModules: {
      localIdentName: string;
    },
    less: {};
    sass: {
      indentedSyntax: boolean;
    };
    scss: {};
    stylus: {};
  };
  /**
   * 手机端框架
   */
  wapFramework: string;
  /**
   * 电脑端框架
   */
  webFramework: string;
  /**
   * 驱动框架,false 保持和对应端一致
   */
  headFramework: string | false;
};

export class BuildOptions {
  /**
   * 控制部分构建信息输出日志
   * 类型: Boolean
   * 默认: 检测到CI或test环境时启用 std-env
   */
  quiet: boolean;
  /**
   * 使用 webpack-bundle-analyzer 分析并可视化构建后的打包文件，
   * 你可以基于分析结果来决定如何优化它。
   *
   * 类型： Boolean 或 Object
   * 默认值： false
   */
  analyze: boolean | BundleAnalyzer.BundleAnalyzerPlugin.Options;
  /**
   * 开启 profiler 请查看 WebpackBar
   * 类型: Boolean
   * 默认: 开启只需在命令行中加入： --profile
   */
  profile: boolean;
  /**
   * 使用extract-text-webpack-plugin将主块中的 CSS 提取到一个单独的 CSS 文件中（自动注入模板），该文件允许单独缓存文件。
   *
   * 当有很多共用 CSS 时建议使用此方法，
   * 异步组件中的 CSS 将保持内联为JavaScript字符串并由vue-style-loader处理。
   * 类型: Boolean
   * 默认: false
   */
  extractCSS: boolean;
  /**
   * 开启 CSS Source Map 支持
   * 类型: boolean
   * 默认: true 为开发模式(development)， false 为生产模式(production)，undefined 自动根据环境变量来
   */
  cssSourceMap: boolean | undefined;
  /**
   * 在webpack构建打包中开启 thread-loader。
   */
  parallel: boolean;
  /**
   * 启用 uglifyjs-webpack-plugin 和 cache-loader 的缓存
   * 类型: Boolean
   * 默认: false
   */
  cache: boolean;
  /**
   * 开启 HardSourceWebpackPlugin
   * 类型: Boolean
   * 默认: false
   */
  hardSource: false | any;
  /**
   * weex构建
   */
  weex: Weex;
  /**
   * 浏览器构建配置
   */
  browser: Browser;
  /**
   * 自定义打包文件名
   *
   * 官方文档
   * @see:https://webpack.js.org/guides/code-splitting/
   * 中文文档
   * @see:https://www.webpackjs.com/guides/code-splitting/
   */
  filenames: {
    app: getFilenames;
    chunk: getFilenames;
    css: getFilenames;
    img: getFilenames;
    font: getFilenames;
    video: getFilenames;
  };
  /**
   * 您可以使用watch来监听文件更改。
   * 此功能特别适用用在modules中。
   * 类型: Array<String>
   */
  watch: watch[];

  watchers: webpack.Compiler.WatchOptions;
  /**
   * chokidar.WatchOptions
   */
  chokidar: WatchOptions;
  /**
   * 监听
   */
  chokidarWatch: (paths: string | string[], options?: WatchOptions) => FSWatcher;
  /**
   * 统一webpack-stats
   * 如果你不希望使用 quiet 或 noInfo 这样的不显示信息，
   * 而是又不想得到全部的信息，
   * 只是想要获取某部分 bundle 的信息，
   * 使用 stats 选项是比较好的折衷方式。
   */
  stats: webpack.Options.Stats;
  /**
   * 临时用的内存文件系统
   */
  memoryFileSystem: MFS & cachedFileSystem;
  /**
   * 本地文件系统
   */
  localFileSystem: cachedFileSystem;
  babel: {
    babelrc: boolean;
    plugins?: any[];
    presets?: any[] | ((env: {
      isDev: boolean;
      isDebug: boolean;
      isWeex: boolean;
      isModern: boolean;
      isClient: boolean;
      isServer: boolean;
    }) => any[]);
    cacheDirectory?: string;
  };
  splitChunks: {
    layouts: boolean;
    pages: boolean;
    commons: boolean;
  };
  optimization: webpack.Options.Optimization;
  terser: TerserWebpackPlugin.TerserPluginOptions;
  optimizeCSS: OptimizeCSSAssetsPlugin.Options;
  transpile: Array<string | RegExp>;
  buildExtend: string[];
  /**
   * 类react框架
   */
  aysncModules: string[];
  /**
   * 构造函数
   * @param options 配置项
   */
  constructor(options: buildOptions) {
    if (!options) {
      options = {}
    }
    /**
     * 监听
     */
    if (typeof options.chokidarWatch === 'function') {
      this.chokidarWatch = options.chokidarWatch
    } else {
      // 初始化本地文件系统
      if (false/* 远程文件系统 */) {
        // 初始化 远程文件 监听系统
        this.chokidarWatch = (paths, options) => {
          // 远程构建监听系统
          return chokidar.watch(paths, options)
        }
      } else {
        // 初始化 文件 监听系统
        this.chokidarWatch = (paths, options) => {
          // 本地的监听系统
          return chokidar.watch(paths, options)
        }
      }
    }
    // 初始化内存文件系统
    this.memoryFileSystem = (options.memoryFileSystem as this['memoryFileSystem']) || proxy(new MFS(), cachedFileSystem, { duration: 60000 })

    // 初始化本地文件系统
    if (typeof options.localFileSystem === 'object') {
      this.localFileSystem = options.localFileSystem as this['localFileSystem']
    } else if (false/* 远程文件系统 */) {
      // 远程文件系统
      this.localFileSystem = proxy(/* WebSocketFileSystem */fs, cachedFileSystem, { duration: 60000 })
    } else {
      // 使用文件系统
      this.localFileSystem = proxy(fs, cachedFileSystem, { duration: 60000 })
    }

    // 控制部分构建信息输出日志
    this.quiet = typeof options.quiet === 'boolean' ? options.quiet : Boolean(env.ci || env.test);
    // 使用 webpack-bundle-analyzer 分析并可视化构建后的打包文件
    this.analyze = typeof options.analyze === 'boolean' ? options.analyze : false;
    // 开启 profiler 请查看 WebpackBar
    this.profile = typeof options.profile === 'boolean' ?
      options.profile :
      process.argv.includes('--profile');
    // 当有很多共用 CSS 时建议使用此方法，
    this.extractCSS = typeof options.extractCSS === 'boolean' ?
      options.extractCSS :
      false;
    // 开启 CSS Source Map 支持
    this.cssSourceMap = typeof options.cssSourceMap === 'boolean' ?
      options.cssSourceMap :
      undefined;
    // 在webpack构建打包中开启 thread-loader。
    this.parallel = typeof options.parallel === 'boolean' ? options.parallel : false;
    // uglifyjs-webpack-plugin 和 cache-loader 的缓存
    this.cache = typeof options.cache === 'boolean' ? options.cache : false;
    this.hardSource = typeof options.hardSource === 'boolean' ? options.hardSource : false;
    // 监听;
    this.watch = Array.isArray(options.watch) ? options.watch : [];
    //
    this.watchers = defaultsDeepClone<this['watchers']>(options.watchers, {})
    // chokidar
    this.chokidar = defaultsDeepClone<WatchOptions>(options.chokidar, {
      ignoreInitial: true,
    })
    // 浏览器构建配置
    this.weex = defaultsDeepClone<Weex>(options.weex, {
      enable: true,
      iosAppId: 'etsx.app.easycms.site',
      androidAppId: 'etsx.app.easycms.site',
      watch: [],
      plugins: [],
      devMiddleware: ({} as WebpackDevMiddleware.Options),
    })
    // 浏览器构建配置
    this.filenames = defaultsDeepClone<this['filenames']>(options.filenames, {
      app: ({ isDev, isModern, isWeex }) => isWeex ? '[name].jsbundle.js' : (isDev ? `${isModern ? 'modern-' : ''}[name].js` : '[chunkhash].js'),
      chunk: ({ isDev, isModern }) => isDev ? `${isModern ? 'modern-' : ''}[name].js` : '[chunkhash].js',
      css: ({ isDev }) => isDev ? '[name].css' : '[contenthash].css',
      img: ({ isDev }) => isDev ? '[path][name].[ext]' : 'img/[hash:7].[ext]',
      font: ({ isDev }) => isDev ? '[path][name].[ext]' : 'fonts/[hash:7].[ext]',
      video: ({ isDev }) => isDev ? '[path][name].[ext]' : 'videos/[hash:7].[ext]',
    })
    this.browser = defaultsDeepClone<Browser>(options.browser, {
      enable: true,
      watch: [],
      styleResources: {},
      plugins: [],
      wapFramework: 'raxjs',
      webFramework: 'anujs',
      headFramework: 'anujs',
      html: {
        minify: {
          /**
           * @see: http://perfectionkills.com/experimenting-with-html-minifier/#collapse_boolean_attributes
           */
          collapseBooleanAttributes: true,
          /**
           * 尽可能使用直接Unicode字符
           */
          decodeEntities: true,
          /**
           * 在样式元素和样式属性中缩小CSS（使用clean-css）
           * @see: https://github.com/jakubpawlowicz/clean-css
           */
          minifyCSS: true,
          /**
           * 缩小脚本元素和事件属性中的JavaScript（使用UglifyJS）
           * @see: https://github.com/mishoo/UglifyJS2
           */
          minifyJS: true,
          /**
           * 通过minifier处理条件注释的内容
           */
          processConditionalComments: true,
          /**
           * 使用仅限空格的值删除所有属性
           * false（可能是true，Function(attrName, tag)）
           * @see: http://perfectionkills.com/experimenting-with-html-minifier/#remove_empty_or_blank_attributes
           */
          removeEmptyAttributes: true,
          /**
           * 值匹配默认值时删除属性。
           * see: http://perfectionkills.com/experimenting-with-html-minifier/#remove_redundant_attributes
           */
          removeRedundantAttributes: true,
          /**
           * 修剪周围的白色空间ignoreCustomFragments。
           */
          trimCustomFragments: true,
          /**
           * doctype用短（HTML5）doctype 替换
           * @see: http://perfectionkills.com/experimenting-with-html-minifier/#use_short_doctype
           */
          useShortDoctype: true,
        },
      },
      devMiddleware: ({} as WebpackDevMiddleware.Options),
      hotMiddleware: {},
      loaders: {
        file: {},
        fontUrl: { limit: 1000 },
        imgUrl: { limit: 1000 },
        css: {},
        cssModules: {
          localIdentName: '[local]_[hash:base64:5]',
        },
        less: {},
        sass: {
          indentedSyntax: true,
        },
        scss: {},
        stylus: {},
      },
    })

    this.stats = defaultsDeepClone<webpack.Options.Stats>(options.stats, {
      /**
       * 将资源显示在 stats 中的情况排除，
       * 这可以通过 String, RegExp, 获取 assetName 的函数来实现，
       * 并返回一个布尔值或如下所述的数组。
       */
      excludeAssets: [
        /.map$/,
        /index\..+\.html$/,
        /vue-ssr-(client|modern)-manifest.json/,
      ],
    })
    this.babel = defaultsDeepClone<this['babel']>(options.babel, {
      babelrc: false,
      cacheDirectory: undefined,
    })
    this.splitChunks = defaultsDeepClone<this['splitChunks']>(options.splitChunks, {
      layouts: false,
      pages: true,
      commons: true,
    })
    this.optimization = defaultsDeepClone<this['optimization']>(options.optimization, {
      runtimeChunk: 'single',
      minimize: undefined,
      minimizer: undefined,
      splitChunks: {
        chunks: 'all',
        automaticNameDelimiter: '.',
        name: undefined,
        cacheGroups: {},
      },
    })
    // Name of NPM packages to be transpiled
    this.transpile = Array.isArray(options.transpile) ? options.transpile : []
    this.terser = defaultsDeepClone<this['terser']>(options.optimization, {})
    this.optimizeCSS = defaultsDeepClone<this['optimizeCSS']>(options.optimization || {}, {})
    this.buildExtend = Array.isArray(options.buildExtend) ? options.buildExtend : [];
    // 框架
    this.aysncModules = Array.isArray(options.aysncModules) ? options.aysncModules : []
    Object.assign(this, {
      // 后续需要完善的
      postcss: {
        preset: {
          // https://cssdb.org/#staging-process
          stage: 2,
        },
      },
    })
  }
}
export default BuildOptions

export type buildOptions = getOptions<BuildOptions>
