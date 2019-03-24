'use strict'
const utils = require('./utils.js')
const tableLayout = require('./layout.js')
// https://www.npmjs.com/package/cli-table
// https://www.npmjs.com/package/cli-table2
class Table extends Array {
  constructor (options) {
    super(...Array.prototype.slice.call(arguments, (typeof options === 'object' ? 1 : 0)))
    this.options = utils.mergeOptions(typeof options === 'object' ? options : {})
  }
  toString () {
    var array = this
    var headersPresent = this.options.head && this.options.head.length
    if (headersPresent) {
      array = [this.options.head]
      if (this.length) {
        array.push.apply(array, this)
      }
    } else {
      this.options.style.head = []
    }

    var cells = tableLayout.makeTableLayout(array)

    cells.forEach(function (row) {
      row.forEach(function (cell) {
        cell.mergeTableOptions(this.options, cells)
      }, this)
    }, this)

    tableLayout.computeWidths(this.options.colWidths, cells)
    tableLayout.computeHeights(this.options.rowHeights, cells)

    cells.forEach(function (row, rowIndex) {
      row.forEach(function (cell, cellIndex) {
        cell.init(this.options)
      }, this)
    }, this)

    var result = []

    for (var rowIndex = 0; rowIndex < cells.length; rowIndex++) {
      var row = cells[rowIndex]
      var heightOfRow = this.options.rowHeights[rowIndex]

      if (rowIndex === 0 || !this.options.style.compact || (rowIndex === 1 && headersPresent)) {
        doDraw(row, 'top', result)
      }

      for (var lineNum = 0; lineNum < heightOfRow; lineNum++) {
        doDraw(row, lineNum, result)
      }

      if (rowIndex + 1 === cells.length) {
        doDraw(row, 'bottom', result)
      }
    }

    return result.join('\n')
  }
  get width () {
    var str = this.toString().split('\n')
    return str[0].length
  }
}
function doDraw (row, lineNum, result) {
  var line = []
  row.forEach(function (cell) {
    line.push(cell.draw(lineNum))
  })
  var str = line.join('')
  if (str.length) result.push(str)
}

module.exports = Table
