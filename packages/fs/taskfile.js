
const notifier = require('node-notifier')

export async function src (task, opts) {
  await task.source(opts.src || 'src/**/*.+(js|ts|tsx)').typescript({ module: 'commonjs' }).target('./dist/')
  notify('Compiled src files')
}

export async function build (task) {
  await task.parallel(['src'])
}

export default async function (task) {
  await task.clear('dist')
  await task.start('build')
  await task.watch('src/**/*.+(js|ts|tsx)', 'src')
}

export async function release (task) {
  await task.clear('dist').start('build')
}

// notification helper
function notify (msg) {
  return notifier.notify({
    title: '▲ Etsx-fs',
    message: msg,
    icon: false
  })
}
