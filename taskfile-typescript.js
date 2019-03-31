'use strict'
try {
  const ts = require('typescript')
  const path = require('path')
  const extname = require('path').extname
  const config = require('./tsconfig.json')

  module.exports = function (task) {
    task.plugin('typescript', { every: true }, function * (file, options) {
      const { stripExtension } = options
      const opts = {
        fileName: file.base,
        compilerOptions: {
          ...config.compilerOptions,
          ...options,
          stripExtension: undefined // since it's an option of the typescript taskr plugin
        }
      }

      const ext = extname(file.base)
      // For example files without an extension don't have to be rewritten
      if (ext) {
        // Replace `.ts` with `.js`
        const extRegex = new RegExp(ext.replace('.', '\\.') + '$', 'i')
        file.base = file.base.replace(extRegex, stripExtension ? '' : '.js')
      }

      // compile output
      const result = ts.transpileModule(file.data.toString(), opts)

      if (opts.compilerOptions.sourceMap && result.sourceMapText) {
        if (result.sourceMapText) {
          try {
            const t = typeof result.sourceMapText === 'string' ? JSON.parse(result.sourceMapText) : (typeof result.sourceMapText === 'object' ? result.sourceMapText : {})
            if (Array.isArray(t.sources)) {
              t.sources = t.sources.map((p) => {
                const pa = path.normalize((file.dir || '') + '/' + (p || '')).replace(/\\/, '/').split('/').filter(Boolean)
                if (pa.length > 2 && `${pa[0]}.${pa[2]}` === 'packages.src') {
                  pa.splice(0, 2)
                }
                return (new Array(pa.length - 1)).fill('..').concat(pa).join('/')
              })
            }
            result.sourceMapText = JSON.stringify(t)
          } catch (error) {
          }
        }
        // add sourcemap to `files` array
        this._.files.push({
          dir: file.dir,
          base: `${file.base}.map`,
          data: Buffer.from(JSON.stringify(result.sourceMapText), 'utf8')
        })
      }

      // update file's data
      file.data = Buffer.from(result.outputText.replace(/process\.env\.__ETSX_VERSION/, `"${require('./package.json').version}"`), 'utf8')
    })
  }
} catch (err) {
  console.error(err)
}
