import webpack from 'webpack'

export default class WarnFixPlugin {
  apply(compiler: webpack.Compiler) /* istanbul ignore next */ {
    compiler.hooks.done.tap('warnfix-plugin', (stats) => {
      stats.compilation.warnings = stats.compilation.warnings.filter((warn) =>
        !(warn.name === 'ModuleDependencyWarning' &&
          warn.message.includes(`export 'default'`) &&
          warn.message.includes('nuxt_plugin_')))
    })
  }
}
