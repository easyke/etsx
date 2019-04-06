const notifier = require('node-notifier')
module.exports = {
  * default (task) {
    yield task.start('release')
    yield task.watch('packages/etsx/src/**/*.+(js|ts|tsx)', 'etsx')
    yield task.watch('packages/server/src/**/*.+(js|ts|tsx)', '@etsx/server')
    yield task.watch('packages/renderer/src/**/*.+(js|ts|tsx)', '@etsx/renderer')
    yield task.watch('packages/listener/src/**/*.+(js|ts|tsx)', '@etsx/listener')
    yield task.watch('packages/utils/src/**/*.+(js|ts|tsx)', '@etsx/utils')
    yield task.watch('packages/cli/src/**/*.+(js|ts|tsx)', '@etsx/cli')
    yield task.watch('packages/fs/src/**/*.+(js|ts|tsx)', '@etsx/fs')
    yield task.watch('packages/builder/src/**/*.+(js|ts|tsx)', '@etsx/builder')
    yield task.watch('packages/bundler-tsx/src/**/*.+(js|ts|tsx)', '@etsx/bundler-tsx')
    yield task.watch('packages/bundler-ios/src/**/*.+(js|ts|tsx)', '@etsx/bundler-ios')
    yield task.watch('packages/bundler-android/src/**/*.+(js|ts|tsx)', '@etsx/bundler-android')
    yield task.watch('packages/babel-preset-app/src/**/*.+(js|ts|tsx)', '@etsx/babel-preset-app')
  },
  * release (task) {
    yield task.start('clear').start('build')
  },
  * clear (task) {
    yield task.clear('packages/etsx/dist')
    yield task.clear('packages/server/dist')
    yield task.clear('packages/renderer/dist')
    yield task.clear('packages/listener/dist')
    yield task.clear('packages/utils/dist')
    yield task.clear('packages/cli/dist')
    yield task.clear('packages/fs/dist')
    yield task.clear('packages/builder/dist')
    yield task.clear('packages/bundler-tsx/dist')
    yield task.clear('packages/bundler-ios/dist')
    yield task.clear('packages/bundler-android/dist')
    yield task.clear('packages/babel-preset-app/dist')
  },
  * build (task) {
    yield task.parallel([
      'etsx',
      '@etsx/server',
      '@etsx/renderer',
      '@etsx/listener',
      '@etsx/utils',
      '@etsx/cli',
      '@etsx/fs',
      '@etsx/builder',
      '@etsx/bundler-tsx',
      '@etsx/bundler-ios',
      '@etsx/bundler-android',
      '@etsx/babel-preset-app'
    ])
  },
  * etsx (task) {
    yield task.source('packages/etsx/src/**/*.+(js|ts|tsx)').typescript({ module: 'commonjs' }).target('packages/etsx/dist/')
    notify('Compiled etsx files')
  },
  * '@etsx/server' (task) {
    yield task.source('packages/server/src/**/*.+(js|ts|tsx)').typescript({ module: 'commonjs' }).target('packages/server/dist/')
    notify('Compiled @etsx/server files')
  },
  * '@etsx/renderer' (task) {
    yield task.source('packages/renderer/src/**/*.+(js|ts|tsx)').typescript({ module: 'commonjs' }).target('packages/renderer/dist/')
    notify('Compiled @etsx/renderer files')
  },

  * '@etsx/listener' (task) {
    yield task.source('packages/listener/src/**/*.+(js|ts|tsx)').typescript({ module: 'commonjs' }).target('packages/listener/dist/')
    notify('Compiled @etsx/listener files')
  },

  * '@etsx/utils' (task) {
    yield task.source('packages/utils/src/**/*.+(js|ts|tsx)').typescript({ module: 'commonjs' }).target('packages/utils/dist/')
    notify('Compiled @etsx/utils files')
  },

  * '@etsx/cli' (task) {
    yield task.source('packages/cli/src/**/*.+(js|ts|tsx)').typescript({ module: 'commonjs' }).target('packages/cli/dist/')
    notify('Compiled @etsx/cli files')
  },

  * '@etsx/fs' (task) {
    yield task.source('packages/fs/src/**/*.+(js|ts|tsx)').typescript({ module: 'commonjs' }).target('packages/fs/dist/')
    notify('Compiled @etsx/fs files')
  },

  * '@etsx/builder' (task) {
    yield task.source('packages/builder/src/**/*.+(js|ts|tsx)').typescript({ module: 'commonjs' }).target('packages/builder/dist/')
    notify('Compiled @etsx/builder files')
  },

  * '@etsx/bundler-tsx' (task) {
    yield task.source('packages/bundler-tsx/src/**/*.+(js|ts|tsx)').typescript({ module: 'commonjs' }).target('packages/bundler-tsx/dist/')
    notify('Compiled @etsx/bundler-tsx files')
  },

  * '@etsx/bundler-ios' (task) {
    yield task.source('packages/bundler-ios/src/**/*.+(js|ts|tsx)').typescript({ module: 'commonjs' }).target('packages/bundler-ios/dist/')
    notify('Compiled @etsx/bundler-ios files')
  },

  * '@etsx/bundler-android' (task) {
    yield task.source('packages/bundler-android/src/**/*.+(js|ts|tsx)').typescript({ module: 'commonjs' }).target('packages/bundler-android/dist/')
    notify('Compiled @etsx/bundler-android files')
  },

  * '@etsx/babel-preset-app' (task) {
    yield task.source('packages/babel-preset-app/src/**/*.+(js|ts|tsx)').typescript({ module: 'commonjs' }).target('packages/babel-preset-app/dist/')
    notify('Compiled @etsx/babel-preset-app files')
  }

}

// notification helper
function notify (msg) {
  return notifier.notify({
    title: '▲ Etsx',
    message: msg,
    icon: false
  })
}
