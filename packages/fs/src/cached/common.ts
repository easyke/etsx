export type fs = any
export let methods = getMethodsByString('stat mkdir readdir rmdir readFile unlink')
export function getFileSystem<FS extends fs>(this: FS, xfs?: FS): FS {
  if (isFileSystem(this)) {
    return this
  } else if (xfs && isFileSystem(xfs)) {
    return xfs
  } else {
    throw new Error('没有传入文件系统')
  }
}
export function isFileSystem(fs: fs): boolean {
  return Array.isArray(methods) && Boolean(methods.filter((method) => fs && fs[method]).length === methods.length)
}
export function setMethods(ms: string | string[]) {
  methods = getMethodsByString(ms)
}

function getMethodsByString(str: string | string[]): string[] {
  if (Array.isArray(str)) {
    return str
  } else if (typeof str !== 'string') {
    return []
  }
  const res = str.split(' ')
  res.push(...res.map((method) => `${method}Sync`))
  return res
}
