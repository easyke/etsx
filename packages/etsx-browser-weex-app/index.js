const path = require('path')
const pkg = require('./package.json')
const template = {
  dependencies: pkg.dependencies,
  dir: path.join(__dirname, 'template'),
  files: [
    'weex.js',
    'empty.js',
    'config.js',
    'common.js',
    'client.js',
    'server.js',
    'renderer.js',
    'components/document.js',
    'client-utils.js',
    'views/app.template.html',
    'framework/base.js',
    'framework/raxjs.js',
    'framework/anujs.js',
    'framework/index.js',
    'framework/render-ssr.js'
    // 'middleware.js',
    // 'router/history/abstract.ts',
    // 'router/history/base.ts',
    // // 'router/history/html5.ts',
    // // 'router/history/weex.ts',
    // 'router/error.ts',
    // 'router/index.ts',
    // 'router/index.d.ts',
    // 'router/create-matcher.ts',
    // 'router/create-router-view.ts',
    // 'router/util/async.ts',
    // 'router/util/path.ts',
    // 'router/util/push-state.ts',
    // 'router/util/query.ts',
    // 'router/util/resolve-components.ts',
    // 'router/util/route.ts',
    // 'router/util/scroll.ts',
    // 'router/util/warn.ts',
    // 'utils.js',
  ]
}

module.exports = template
