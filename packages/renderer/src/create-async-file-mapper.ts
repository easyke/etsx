import { browserManifest } from './renderer'
/**
 * Creates a mapper that maps components used during a server-side render
 * to async chunk files in the client-side build, so that we can inline them
 * directly in the rendered HTML to avoid waterfall requests.
 */

export type AsyncFileMapper = (files: string[]) => string[];

export function createMapper(
  browserManifest: browserManifest,
): AsyncFileMapper {
  const map = createMap(browserManifest)
  // map server-side moduleIds to client-side files
  return function mapper(moduleIds: string[]): string[] {
    const res = new Set()
    moduleIds.forEach((moduleId) => {
      const mapped = map.get(moduleId)
      if (mapped && Array.isArray(mapped)) {
        mapped.forEach((m) => res.add(m))
      }
    })
    return Array.from(res)
  }
}

function createMap(browserManifest: browserManifest): Map<string, string[]> {
  const map: Map<string, string[]> = new Map()
  Object.keys(browserManifest.modules).forEach((id) => {
    map.set(id, mapIdToFile(id, browserManifest))
  })
  return map
}

function mapIdToFile(id: string | number, browserManifest: browserManifest): string[] {
  const files: string[] = []
  const fileIndices = browserManifest.modules[id]
  if (fileIndices) {
    fileIndices.forEach((index) => {
      const file = browserManifest.all[index]
      // only include async files or non-js, non-css assets
      if (browserManifest.async.indexOf(file) > -1 || !(/\.(js|css)($|\?)/.test(file))) {
        files.push(file)
      }
    })
  }
  return files
}
