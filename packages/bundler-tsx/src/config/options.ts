import BaseWebpackConfig from './base'
import BuildContext from './context'

import clone from 'lodash/clone'
import path from 'path'
import webpack from 'webpack'
import TimeFixPlugin from '../plugins/time-fix-plugin'
import WarnFixPlugin from '../plugins/warnfix'
// import ExtractCssChunksPlugin from 'extract-css-chunks-webpack-plugin'
import HardSourcePlugin from 'hard-source-webpack-plugin'
import { logger, isUrl, urlJoin, stdEnv as env } from '@etsx/utils'
import { BuildOptions } from '@etsx/builder'

const WebpackBar: any = require('webpackbar')

export class OptionsWebpackConfig extends BaseWebpackConfig {
  public constructor(context: BuildContext) {
    super(context)
    this.output = getOutput(context)
    this.resolve.alias = getAlias(context)
    loadRules(context, this.module.rules)
    loadPlugins(context, this.plugins)
  }
}

export const getAlias = (context: BuildContext): { [key: string]: string; } => {
  const {options: {dir}} = context
  const assetsDir = 'assets'
  const staticDir = 'static'
  return {
    '~': dir.src,
    '~~': dir.root,
    '@': dir.src,
    '@@': dir.root,
    [assetsDir]: path.join(dir.src, assetsDir),
    [staticDir]: path.join(dir.src, staticDir),
  };
}
export const loadRules = (context: BuildContext, rules: webpack.RuleSetRule[]) => {
  const babelOptions = getBabelOptions(context)
  if (!Array.isArray(babelOptions.plugins)) {
    babelOptions.plugins = []
  }
  babelOptions.plugins.push(require.resolve('../plugins/react-directive.js'))
  rules.push({
    test: /\.tsx?$/i,
    exclude: /node_modules/,
    use: [
      {
        loader: 'babel-loader',
        options: babelOptions,
      },
      {
        loader: 'ts-loader',
      },
    ],
  })
  rules.push({
    test: /\.jsx?$/i,
    exclude: /node_modules/,
    use: [
      {
        loader: 'babel-loader',
        options: babelOptions,
      },
    ],
  })
  // JSON is not enabled by default in Webpack but both Node and Browserify
  // allow it implicitly so we also enable it.
  rules.push({
    test: /\.json$/,
    use: [
      {
        loader: 'json-loader',
      },
    ],
  })
}
export const loadPlugins = (context: BuildContext, plugins: webpack.Plugin[]) => {
  const { etsx, name, color, options, buildOptions, isServer } = context
  // Add timefix-plugin before others plugins
  if (options.dev) {
    plugins.push(new TimeFixPlugin())
  }

  // CSS extraction)
  /*if (buildOptions.extractCSS) {
    plugins.push(new ExtractCssChunksPlugin(Object.assign({
      filename: this.getFileName('css'),
      chunkFilename: this.getFileName('css'),
      // TODO: https://github.com/faceyspacey/extract-css-chunks-webpack-plugin/issues/132
      reloadAll: true,
    }, buildOptions.extractCSS)))
  }*/

  Array.prototype.push.apply(plugins, buildOptions.browser.plugins || [])

  // Hide warnings about plugins without a default export (#1179)
  plugins.push(new WarnFixPlugin())

  // Build progress indicator
  plugins.push(new WebpackBar({
    name,
    color,
    reporters: [
      'basic',
      'fancy',
      'profile',
      'stats',
    ],
    basic: !buildOptions.quiet && env.minimalCLI,
    fancy: !buildOptions.quiet && !env.minimalCLI,
    profile: !buildOptions.quiet && buildOptions.profile,
    stats: !buildOptions.quiet && !options.dev && buildOptions.stats,
    reporter: {
      change: (context: webpack.Stats, { shortPath }: { shortPath: string; }) => {
        if (!isServer) {
          etsx.callHook('bundler-tsx:change', shortPath)
        }
      },
      done: (context: webpack.Stats) => {
        if (context.hasErrors) {
          etsx.callHook('bundler-tsx:error')
        }
      },
      allDone: () => {
        etsx.callHook('bundler-tsx:done')
      },
    },
  }))

  plugins.push(new webpack.DefinePlugin(context.env))
  if (buildOptions.hardSource) {
    plugins.push(new HardSourcePlugin(Object.assign({}, buildOptions.hardSource)))
  }

  return plugins;
}

export const getOutput = (context: BuildContext): webpack.Output => {
  const { isWeex, isServer, options } = context;
  return {
    path: isWeex ? options.dir.dist.weex : path.resolve(options.dir.build, 'dist', isServer ? 'server' : 'client'),
    filename: getFileName('app', context),
    chunkFilename: getFileName('chunk', context),
    publicPath: isUrl(options.publicPath)
      ? options.publicPath
      : urlJoin(options.router.base, options.publicPath),
  }
}

export const getFileName = (key: keyof BuildOptions['filenames'], { options, buildOptions, etsxEnv, isModern }: BuildContext): string => {
  if (buildOptions.analyze) {
    if (['app', 'chunk'].includes(key)) {
      return `${isModern ? 'modern-' : ''}[name].js`
    }
  }
  let fileName = buildOptions.filenames[key]
  if (typeof fileName === 'function') {
    fileName = fileName(etsxEnv)
  }
  if (options.dev) {
    const hash = /\[(chunkhash|contenthash|hash)(?::(\d+))?]/.exec(fileName)
    if (hash) {
      logger.warn(`Notice: Please do not use ${hash[1]} in dev mode to prevent memory leak`)
    }
  }
  return fileName
}

export const getBabelOptions = (context: BuildContext): { babelrc?: boolean; presets: any[], plugins: any[] } => {
  const options = clone(context.buildOptions.babel)

  if (typeof options.presets === 'function') {
    options.presets = options.presets({
      isDev: context.options.dev,
      isDebug: !!context.options.debug,
      isWeex: context.isWeex,
      isModern: context.isModern,
      isClient: !context.isServer,
      isServer: context.isServer,
    })
  }
  if (!options.babelrc && !options.presets) {
    const buildTarget = ['server', 'client', 'weex', 'modern'].includes(context.name) ? context.name : 'client'
    options.presets = [
      [
        require.resolve('@etsx/babel-preset-app'),
        {
          isDev: context.options.dev,
          isDebug: false,
          isModern: context.isModern,
          buildTarget,
        },
      ],
    ]
  }
  return options as any
}

export default OptionsWebpackConfig
