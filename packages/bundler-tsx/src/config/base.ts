import webpack from 'webpack'
import { getOptionsNoVoid } from '@etsx/utils'
import BuildContext from './context'

export const wc = Symbol('WebpackConfiguration')

export class BaseWebpackConfig implements webpack.Configuration {
  /**
   * Enable production optimizations or development hints.
   *
   * see: https://webpack.docschina.org/concepts/mode/#usage
   * development
   * 将 process.env.NODE_ENV 的值设为 development。
   * 会启用
   * * NamedChunksPlugin
   * * NamedModulesPlugin
   *
   * production
   * 将 process.env.NODE_ENV 的值设为 production。
   * 会启用
   * * FlagDependencyUsagePlugin,
   * * FlagIncludedChunksPlugin,
   * * ModuleConcatenationPlugin,
   * * NoEmitOnErrorsPlugin,
   * * OccurrenceOrderPlugin,
   * * SideEffectsFlagPlugin,
   * * UglifyJsPlugin.
   */
  mode: getOptionsNoVoid<webpack.Configuration['mode']>;
  /** Name of the configuration. Used when loading multiple configurations. */
  name: getOptionsNoVoid<webpack.Configuration['name']>;
  /**
   * The base directory (absolute path!) for resolving the `entry` option.
   * If `output.pathinfo` is set, the included pathinfo is shortened to this directory.
   */
  context: getOptionsNoVoid<webpack.Configuration['context']>;
  entry?: webpack.Configuration['entry'];
  /** Choose a style of source mapping to enhance the debugging process. These values can affect build and rebuild speed dramatically. */
  devtool: webpack.Options.Devtool;
  /** Options affecting the output. */
  output: webpack.Output;
  /** Options affecting the normal modules (NormalModuleFactory) */
  module: webpack.Module;
  /** Options affecting the resolving of modules. */
  resolve: webpack.Resolve;
  /** Like resolve but for loaders. */
  resolveLoader: webpack.ResolveLoader;
  /**
   * Specify dependencies that shouldn’t be resolved by webpack, but should become dependencies of the resulting bundle.
   * The kind of the dependency depends on output.libraryTarget.
   */
  externals?: webpack.Configuration['externals'];
  /**
   * - "web" Compile for usage in a browser-like environment (default).
   * - "webworker" Compile as WebWorker.
   * - "node" Compile for usage in a node.js-like environment (use require to load chunks).
   * - "async-node" Compile for usage in a node.js-like environment (use fs and vm to load chunks async).
   * - "node-webkit" Compile for usage in webkit, uses jsonp chunk loading but also supports builtin node.js modules plus require(“nw.gui”) (experimental)
   * - "atom" Compile for usage in electron (formerly known as atom-shell), supports require for modules necessary to run Electron.
   * - "electron-renderer" Compile for Electron for renderer process, providing a target using JsonpTemplatePlugin, FunctionModulePlugin for browser
   *   environments and NodeTargetPlugin and ExternalsPlugin for CommonJS and Electron built-in modules.
   * - "electron-main" Compile for Electron for main process.
   * - "atom" Alias for electron-main.
   * - "electron" Alias for electron-main.
   */
  target?: 'web' | 'webworker' | 'node' | 'async-node' | 'node-webkit' | 'atom' | 'electron' | 'electron-renderer' | 'electron-main' | ((compiler?: any) => void);
  /** Report the first error as a hard error instead of tolerating it. */
  bail?: boolean;
  /** Capture timing information for each module. */
  profile?: boolean;
  /** Cache generated modules and chunks to improve performance for multiple incremental builds. */
  cache?: boolean | object;
  /** Enter watch mode, which rebuilds on file change. */
  watch?: boolean;
  watchOptions?: webpack.Options.WatchOptions;
  /** Switch loaders to debug mode. */
  debug: webpack.Configuration['debug'];
  /** Include polyfills or mocks for various node stuff */
  node: webpack.Configuration['node'];
  /** Set the value of require.amd and define.amd. */
  amd: webpack.Configuration['amd'];
  /** Used for recordsInputPath and recordsOutputPath */
  recordsPath: webpack.Configuration['recordsPath'];
  /** Load compiler state from a json file. */
  recordsInputPath: webpack.Configuration['recordsInputPath'];
  /** Store compiler state to a json file. */
  recordsOutputPath: webpack.Configuration['recordsOutputPath'];
  /** Add additional plugins to the compiler. */
  plugins: webpack.Plugin[];
  /** Stats options for logging  */
  stats?: webpack.Options.Stats;
  /** Performance options */
  performance?: webpack.Options.Performance | false;
  /** Limit the number of parallel processed modules. Can be used to fine tune performance or to get more reliable profiling results */
  parallelism?: number;
  /** Optimization options */
  optimization?: webpack.Options.Optimization;
  public constructor(context: BuildContext) {
    const { etsx, name, options } = context
    this.name = name
    // this.mode
    this.mode = process.env.NODE_ENV as webpack.Configuration['mode'] || 'none'
    // this.mode 检验
    if (!['development', 'production', 'none'].includes(this.mode || '')) {
      this.mode = 'none'
    }
    // this.context
    this.context = etsx.options.dir.root || process.cwd()
    // 调试模式
    this.devtool = false
    // 插件
    this.plugins = []

    const webpackModulesDir = ['node_modules'].concat(options.modulesDir)

    this.resolve = {
      extensions: ['.js', '.jsx', '.json', '.mjs', '.ts', '.tsx'],
      alias: {},
      modules: webpackModulesDir,
    }
    /**
     * resolveLoader相当于是针对webpack Loader 的单独 resolve 配置，
     * 做用和resolve一样，但只作用于webpack loader
     * see: https://webpack.docschina.org/configuration/resolve/#resolveloader
     */
    this.resolveLoader = {
      modules: webpackModulesDir,
    }

    this.output = {}

    this.performance = {
      hints: false,
      maxAssetSize: Infinity,
    }

    this.module = {
      rules: [],
    }
  }
  /**
   * pushResolveExtensions
   */
  public pushResolveExtensions(...args: string[]) {
    if (!Array.isArray(this.resolve.extensions)) {
      this.resolve.extensions = []
    }
    this.resolve.extensions.push(...args.filter((item) => !this.resolve.extensions || this.resolve.extensions.indexOf(item) === -1))
  }
}
export default BaseWebpackConfig
