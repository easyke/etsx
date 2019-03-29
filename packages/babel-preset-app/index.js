'use strict'
const input = require('./dist/index.js')
if (input['default']) {
  exports = input['default']
  Object.keys(input).forEach((key) => {
    exports[key] = input[key]
  })
} else {
  exports = input
}
module.exports = exports
