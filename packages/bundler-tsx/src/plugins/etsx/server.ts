import webpack from 'webpack'
import { validate, isJS } from '../util'
import { getOptions } from '@etsx/utils'
import { RawSource } from 'webpack-sources'
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
};
export class EtsxSSRServerAssetManifestPlugin {
  filename: string;
  constructor(options: getOptions<EtsxSSRServerAssetManifestPlugin>) {
    options = options || {}
    this.filename = options.filename || 'server.manifest.json'
  }

  apply(compiler: webpack.Compiler) {
    validate(compiler)

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

      const bundle: bundle = {
        entry,
        files: {},
        maps: {},
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
