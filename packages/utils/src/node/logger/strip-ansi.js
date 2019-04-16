'use strict'
const ansiRegex = require('./ansi-regex.js')

module.exports = input => typeof input === 'string' ? input.replace(ansiRegex(), '') : input
