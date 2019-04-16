/**
 * This file is based on Vue.js (MIT) webpack plugins
 * https://github.com/vuejs/vue/blob/dev/src/server/webpack-plugin/util.js
 */

import { logger } from '@etsx/utils'
import webpack from 'webpack'

export const validate = (compiler: webpack.Compiler) => {
  if (compiler.options.target !== 'node') {
    logger.warn('webpack config `target` should be "node".')
  }

  if (compiler.options.output && compiler.options.output.libraryTarget !== 'commonjs2') {
    logger.warn('webpack config `output.libraryTarget` should be "commonjs2".')
  }

  if (!compiler.options.externals) {
    logger.info(
      'It is recommended to externalize dependencies in the server build for ' +
      'better build performance.',
    )
  }
}

const jsReg = /\.js(\?[^.]+)?$/
const cssReg = /\.css(\?[^.]+)?$/

export const isJS = (file: string) => jsReg.test(file)

export const isCSS = (file: string) => cssReg.test(file)
