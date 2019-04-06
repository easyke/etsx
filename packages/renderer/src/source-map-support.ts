import { SourceMapConsumer, RawSourceMap } from 'source-map'

export type rawMaps = { [name: string]: RawSourceMap }
export type mapConsumers = { [name: string]: SourceMapConsumer }

export let filenameRE = /\(([^)]+\.js):(\d+):(\d+)\)$/
export const setFilenameRE = (RE: RegExp) => { filenameRE = RE }

/**
 * 创建地图
 * @param rawMaps 原始rawMaps
 */
export function createSourceMapConsumers(rawMaps: rawMaps): mapConsumers {
  const maps: mapConsumers = {}
  Object.keys(rawMaps).forEach((file) => {
    maps[file] = new SourceMapConsumer(rawMaps[file])
  })
  return maps
}

/**
 * 重写错误栈
 * @param e Error
 * @param mapConsumers mapConsumers
 */
export function rewriteErrorTrace(e: any, mapConsumers: mapConsumers): void {
  if (e && typeof e.stack === 'string') {
    e.stack = e.stack.split('\n').map((line: string) => rewriteTraceLine(line, mapConsumers)).join('\n')
  }
}

function rewriteTraceLine(trace: string, mapConsumers: mapConsumers): string {
  const m = trace.match(filenameRE)
  const map = m && mapConsumers[m[1]]
  if (m != null && map) {
    const originalPosition = map.originalPositionFor({
      line: Number(m[2]),
      column: Number(m[3]),
    })
    if (originalPosition.source != null) {
      const { source, line, column } = originalPosition
      const mappedPosition = `(${source.replace(/^webpack:\/\/\//, '')}:${String(line)}:${String(column)})`
      return trace.replace(filenameRE, mappedPosition)
    } else {
      return trace
    }
  } else {
    return trace
  }
}
