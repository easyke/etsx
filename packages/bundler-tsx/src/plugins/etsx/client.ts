import webpack from 'webpack'
import { RawSource } from 'webpack-sources'
import { getOptions } from '@etsx/utils'
import uniq from 'lodash/uniq'
import { isJS, isCSS } from '../util'

const hash: (src: any) => string = require('hash-sum')

export class EtsxSSRClientAssetManifestPlugin {
  filename: string;
  constructor(options: getOptions<EtsxSSRClientAssetManifestPlugin>) {
    options = options || {}
    this.filename = options.filename || 'client.manifest.json'
  }

  apply(compiler: webpack.Compiler) {
    type assetsMapping = {
      [name: string]: string;
    };
    type modules = {
      [identifier: string]: number[];
    };
    compiler.hooks.emit.tapPromise('EtsxJsBuildManifest', async (compilation: webpack.compilation.Compilation): Promise<void> => {
      const stats = compilation.getStats().toJson()
      const allFiles: string[] = uniq(stats.assets
        .map((a: any) => a && a.name))

      const initialFiles: string[] = uniq(Object.keys(stats.entrypoints)
        .map((name) => stats.entrypoints[name].assets)
        .reduce((assets, all) => all.concat(assets), [])
        .filter((file: string) => isJS(file) || isCSS(file)))

      const asyncFiles: string[] = allFiles
        .filter((file) => isJS(file) || isCSS(file))
        .filter((file) => !initialFiles.includes(file))

      const assetsMapping: assetsMapping = {}
      stats.assets
        .filter((a: any) => a && isJS(a.name))
        .forEach(({ name, chunkNames }: { name: string; chunkNames: string[]; }) => {
          assetsMapping[name] = hash(chunkNames.join('|'))
        })

      const assetManifestMap: {
        publicPath: string;
        all: string[];
        initial: string[];
        async: string[];
        modules: modules;
        assetsMapping: assetsMapping;
      } = {
        publicPath: stats.publicPath,
        all: allFiles,
        initial: initialFiles,
        async: asyncFiles,
        modules: { /* [identifier: string]: Array<index: number> */ },
        assetsMapping,
      }

      const assetModules = stats.modules.filter((m: any) => m.assets.length)
      const fileToIndex = (file: string) => assetManifestMap.all.indexOf(file)
      stats.modules.forEach((m: any) => {
        // Ignore modules duplicated in multiple chunks
        if (m.chunks.length === 1) {
          const cid = m.chunks[0]
          const chunk = stats.chunks.find((c: any) => c.id === cid)
          if (!chunk || !chunk.files) {
            return
          }
          const id = m.identifier.replace(/\s\w+$/, '') // remove appended hash
          const files = assetManifestMap.modules[hash(id)] = chunk.files.map(fileToIndex)

          // Find all asset modules associated with the same chunk
          assetModules.forEach((m: any) => {
            if (m.chunks.some((id: string) => id === cid)) {
              files.push.apply(files, m.assets.map(fileToIndex))
            }
          })
        }
      })

      compilation.assets[this.filename] = new RawSource(JSON.stringify(assetManifestMap, null, 2))

    })
  }
}

export default EtsxSSRClientAssetManifestPlugin;
