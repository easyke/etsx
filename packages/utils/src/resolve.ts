import path from 'path'
import escapeRegExp from 'lodash/escapeRegExp'
import stdEnv from './std-env'

export const startsWithAlias = (aliasArray: string[]) => (str: string) => aliasArray.some((c: string) => str.startsWith(c))

export const startsWithSrcAlias: (str: string) => boolean = startsWithAlias(['@', '~'])

export const startsWithRootAlias: (str: string) => boolean = startsWithAlias(['@@', '~~'])

export function wp(p: string = ''): string {
  /* istanbul ignore if */
  if (stdEnv.isWindows) {
    return p.replace(/\\/g, '\\\\')
  }
  return p
}

export function wChunk(p: string = ''): string {
  /* istanbul ignore if */
  if (stdEnv.isWindows) {
    return p.replace(/\//g, '_')
  }
  return p
}

const reqSep = /\//g
const sysSep = escapeRegExp(path.sep)

export function normalize(string: string) {
  return string.replace(reqSep, sysSep)
}

export function r(...args: string[]): string {
  const lastArg = args[args.length - 1]

  if (startsWithSrcAlias(lastArg)) {
    return wp(lastArg)
  }

  return wp(path.resolve(...args.map(normalize)))
}

export function relativeTo(...args: string[]): string {
  const dir: string = args.shift() || ''

  // Keep webpack inline loader intact
  if (args[0].includes('!')) {
    const loaders = (args.shift() || '').split('!')

    return loaders.concat(relativeTo(dir, (loaders.pop() || ''), ...args)).join('!')
  }

  // Resolve path
  const _path = r(...args)

  // Check if path is an alias
  if (startsWithSrcAlias(_path)) {
    return _path
  }

  // Make correct relative path
  let rp = path.relative(dir, _path)
  if (rp[0] !== '.') {
    rp = './' + rp
  }

  return wp(rp)
}

const isIndex = (s: string) => /(.*)\/index\.[^/]+$/.test(s)

export function isIndexFileAndFolder(pluginFiles) {
  // Return early in case the matching file count exceeds 2 (index.js + folder)
  if (pluginFiles.length !== 2) {
    return false
  }
  return pluginFiles.some(isIndex)
}

export const getMainModule = () => require.main
