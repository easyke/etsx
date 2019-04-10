import webpack from 'webpack'
import { validate, isJS } from '../util'
import { getOptions } from '@etsx/utils'
import uniq from 'lodash/uniq'
import { RawSource, ConcatSource } from 'webpack-sources'
export type bundle = {
  entry: string;
  files: {
    [fileName: string]: string | Buffer;
  };
  maps: {
    [fileName: string]: {
      file: string;
      sources: string;
      sourcesContent: string[];
      mappings: string[];
      sourceRoot: string;
    };
  };
  modules: {
    [identifier: string]: string | number;
  };
};
export class EtsxSSRServerAssetManifestPlugin {
  filename: string;
  constructor(options: getOptions<EtsxSSRServerAssetManifestPlugin>) {
    options = options || {}
    this.filename = options.filename || 'server.manifest.json'
  }

  apply(compiler: webpack.Compiler) {
    validate(compiler)
    // compiler.hooks.compilation.tap('EtsxJsServerManifest', (compilation) => {
    //   // uglify-webpack-plugin将删除在expandOunkAssets中的javascript注释，
    //   // 需要在AfterptimizeChunkAssets后使用，以便在此之后添加frameworkComment
    //   compilation.hooks.afterOptimizeChunkAssets.tap('EtsxJsServerManifest', (chunks) => {

    //     const stats = compilation.getStats().toJson()
    //     const allFiles: string[] = uniq(stats.assets
    //       .map((a: any) => a && a.name))

    //     const initialFiles: string[] = uniq(Object.keys(stats.entrypoints)
    //       .map((name) => stats.entrypoints[name].assets)
    //       .reduce((assets, all) => all.concat(assets), [])
    //       .filter((file: string) => isJS(file)))

    //     const asyncFiles: string[] = allFiles
    //       .filter((file) => isJS(file))
    //       .filter((file) => !initialFiles.includes(file))

    //     const modules: Map<string, string[]> = new Map()
    //     const assetModules = stats.modules.filter((m: any) => m.assets.length)
    //     stats.modules.forEach((m: any) => {
    //       // Ignore modules duplicated in multiple chunks
    //       if (m.chunks.length === 1) {
    //         const cid = m.chunks[0]
    //         const chunk = stats.chunks.find((c: any) => c.id === cid)
    //         if (!chunk || !chunk.files) {
    //           return
    //         }
    //         const files = chunk.files.filter((name: string) => asyncFiles.includes(name))

    //         // Find all asset modules associated with the same chunk
    //         assetModules.forEach((m: any) => {
    //           if (m.chunks.some((id: string) => id === cid)) {
    //             files.push.apply(files, m.assets.filter((name: string) => asyncFiles.includes(name)))
    //           }
    //         })
    //         if (files.length) {
    //           modules.set(m.id, files)
    //         }
    //       }
    //     })
    //     const chunksAsyncModules: Map<string, string[]> = new Map()
    //     modules.forEach((fileNames: string[], moduleId: string) => fileNames.forEach((fileName: string) => {
    //       if (!chunksAsyncModules.has(fileName)) {
    //         chunksAsyncModules.set(fileName, [])
    //       }
    //       (chunksAsyncModules.get(fileName) as string[]).push(moduleId)
    //     }))
    //     const xxxx = (moduleIds: string[]) => {
    //       return `if(typeof __ETSX_SSR_CONTEXT__ === '')__ETSX_SSR_CONTEXT__(999888,${JSON.stringify(moduleIds)})`
    //     }
    //     chunksAsyncModules.forEach((moduleIds, fileName) => {
    //       if (compilation.assets[fileName]) {
    //         compilation.assets[fileName] = new ConcatSource(
    //           xxxx(moduleIds),
    //           '\n',
    //           compilation.assets[fileName],
    //         )
    //       }
    //     })
    //   })
    // })
    compiler.hooks.emit.tapPromise('EtsxJsServerManifest', async (compilation: webpack.compilation.Compilation): Promise<void> => {
      const stats = compilation.getStats().toJson()
      const [entryName] = Object.keys(stats.entrypoints)
      const entryInfo = stats.entrypoints[entryName]

      if (!entryInfo) {
        // #5553
        return
      }

      const entryAssets = entryInfo.assets.filter(isJS)

      if (entryAssets.length > 1) {
        throw new Error(
          `Server-side bundle should have one single entry file. ` +
          `Avoid using CommonsChunkPlugin in the server config.`,
        )
      }

      const [entry] = entryAssets
      if (!entry || typeof entry !== 'string') {
        throw new Error(
          `Entry "${entryName}" not found. Did you specify the correct entry option?`,
        )
      }

      const modules: bundle['modules'] = {}
      stats.modules.forEach((m: any) => {
          modules[m.identifier] = m.id
      })

      const bundle: bundle = {
        entry,
        files: {},
        maps: {},
        modules,
      }

      stats.assets.forEach((asset: any) => {
        if (isJS(asset.name)) {
          bundle.files[asset.name] = asset.name
        } else if (asset.name.match(/\.js\.map$/)) {
          bundle.maps[asset.name.replace(/\.map$/, '')] = asset.name
        } else {
          // Do not emit non-js assets for server
          delete compilation.assets[asset.name]
        }
      })

      compilation.assets[this.filename] = new RawSource(JSON.stringify(bundle, null, 2))
    })
  }
}

export default EtsxSSRServerAssetManifestPlugin
