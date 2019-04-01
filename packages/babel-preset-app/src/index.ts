import path from 'path'
export type targets = any;
export type configPath = any;
export type polyfills = string[];
export type options = {
  isModern?: boolean;
  isDev?: boolean;
  isDebug?: boolean;
  buildTarget: 'server' | 'client' | 'weex' | 'modern';
  // 何时true，编译类属性以使用赋值表达式而不是Object.defineProperty。
  spec?: any;
  loose?: boolean;
  corejs?: 2 | 3 | number;
  useBuiltIns?: false | 'entry' | 'usage';
  // 启用将ES6模块语法转换为其他模块类型。
  modules?: 'amd' | 'umd' | 'systemjs' | 'commonjs' | 'cjs' | 'auto' | boolean;
  polyfills?: polyfills;
  ignoreBrowserslistConfig?: boolean;
  configPath?: configPath;
  include?: any;
  exclude?: any;
  targets?: targets;
  // 默认情况下，此预设将运行目标环境所需的所有变换。
  // 如果要强制运行所有转换，请启用此选项，
  // 如果输出将通过UglifyJS或仅支持ES5的环境运行，则此选项很有用。
  forceAllTransforms?: boolean;
  // Use the legacy (stage 1) decorators syntax and behavior.
  decoratorsLegacy?: boolean;
  shippedProposals?: any;
  decoratorsBeforeExport?: any;
};

export const defaultPolyfills = [
  // Promise polyfill alone doesn't work in IE,
  // Needs this as well. see: #1642
  'es6.array.iterator',
  // This is required for webpack code splitting, vuex etc.
  'es6.promise',
  // #2012 es6.promise replaces native Promise in FF and causes missing finally
  'es7.promise.finally',
]
export function getPolyfills(targets: targets, includes: polyfills, { ignoreBrowserslistConfig, configPath }: { ignoreBrowserslistConfig: boolean, configPath: configPath }): polyfills {
  const { isPluginRequired } = require('@babel/preset-env')
  const builtInsList = require('@babel/preset-env/data/built-ins.json')
  const getTargets = require('@babel/preset-env/lib/targets-parser').default
  const builtInTargets = getTargets(targets, {
    ignoreBrowserslistConfig,
    configPath,
  })

  return includes.filter((item) => isPluginRequired(builtInTargets, builtInsList[item]))
}

export default (context: any, options: options = { buildTarget: 'client' }) => {
  const presets = []
  const plugins = []

  const isModern = !!options.isModern

  const {
    buildTarget,
    corejs = 3,
    spec,
    loose = false,
    isDev = false,
    isDebug = false,
    useBuiltIns = ((isModern || options.buildTarget === 'server') ? false : 'usage'),
    polyfills: userPolyfills,
    ignoreBrowserslistConfig = isModern,
    configPath,
    include,
    exclude,
    shippedProposals,
    forceAllTransforms,
    decoratorsBeforeExport,
    decoratorsLegacy,
  } = options

  let modules = options.modules || false
  let targets = options.targets
  if (modules === true) {
    targets = { esmodules: true }
  } else if (targets === void 0) {
    if (buildTarget === 'weex') {
      modules = 'commonjs'
      targets = { node: 'current' }
    } else if (buildTarget === 'server') {
      modules = 'commonjs'
      targets = { node: 'current' }
    } else {
      targets = {
        browsers: ['last 2 versions', 'ie >= 7'],
      };
    }
  }

  let polyfills: polyfills
  if (isModern === false && useBuiltIns === 'usage' && buildTarget === 'client') {
    polyfills = getPolyfills(targets, userPolyfills || defaultPolyfills, {
      ignoreBrowserslistConfig,
      configPath,
    })
    plugins.push([require.resolve('./polyfills-plugin'), { polyfills }])
  } else {
    polyfills = []
  }
  presets.push([
    require.resolve('@babel/preset-env'),
    {
      spec,
      loose,
      corejs: useBuiltIns !== false ? corejs : false,
      modules,
      targets,
      useBuiltIns,
      ignoreBrowserslistConfig,
      include,
      // exclude: polyfills.concat(exclude || []),
      debug: isDebug,
      shippedProposals,
      forceAllTransforms,
    },
  ])
  plugins.push(
    /* ** Stage 0 - Start ** */
    require.resolve('@babel/plugin-proposal-function-bind'),
    /* ** Stage 0 - End ** */

    /* ** Stage 1 - Start ** */
    require.resolve('@babel/plugin-proposal-export-default-from'),
    require.resolve('@babel/plugin-proposal-logical-assignment-operators'),
    [
      require.resolve('@babel/plugin-proposal-optional-chaining'), {
        loose: false,
      },
    ],
    [
      require.resolve('@babel/plugin-proposal-pipeline-operator'), {
        proposal: 'minimal',
      },
    ],
    [
      require.resolve('@babel/plugin-proposal-nullish-coalescing-operator'), {
        loose: false,
      },
    ],
    require.resolve('@babel/plugin-proposal-do-expressions'),
    /* ** Stage 1 - End ** */

    /* ** Stage 2 - Start ** */
    [
      require.resolve('@babel/plugin-proposal-decorators'), {
        decoratorsBeforeExport,
        legacy: decoratorsLegacy !== false,
      },
    ],
    require.resolve('@babel/plugin-proposal-function-sent'),
    require.resolve('@babel/plugin-proposal-export-namespace-from'),
    require.resolve('@babel/plugin-proposal-numeric-separator'),
    require.resolve('@babel/plugin-proposal-throw-expressions'),
    /* ** Stage 2 - End ** */

    /* ** Stage 3 - Start ** */
    require.resolve('@babel/plugin-syntax-dynamic-import'),
    require.resolve('@babel/plugin-syntax-import-meta'),
    [
      require.resolve('@babel/plugin-proposal-class-properties'), {
        loose,
      },
    ],
    require.resolve('@babel/plugin-proposal-json-strings'),
    /* ** Stage 3 - End ** */
    [
      require.resolve('@babel/plugin-transform-runtime'), {
        regenerator: useBuiltIns !== 'usage',
        corejs: useBuiltIns !== false ? corejs : false,
        helpers: useBuiltIns === 'usage',
        useESModules: true,
        absoluteRuntime: path.dirname(require.resolve('@babel/runtime/package.json')),
      },
    ],
    [
      require.resolve('@babel/plugin-transform-react-jsx'),
      {
        pragma: 'createElement',
        pragmaFrag: 'Fragment',
        throwIfNamespace: true,
        useBuiltIns: false,
      },
    ],

    require.resolve('@babel/plugin-transform-modules-commonjs'),
    require.resolve('@babel/plugin-transform-react-display-name'),
  )
  if (isDev) {
    plugins.push(require.resolve('@babel/plugin-transform-react-jsx-source'))
    plugins.push(require.resolve('@babel/plugin-transform-react-jsx-self'))
  }
  return {
    presets,
    plugins,
  }
}
