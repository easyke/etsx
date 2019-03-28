import webpack from 'webpack'
import { ConcatSource } from 'webpack-sources'

export type frameworkComment = string;
export type opts = {
  frameworkComment?: frameworkComment;
};
export class WeexJsbundleFrameworkComment {
  frameworkComment: frameworkComment;
  constructor(opts?: opts) {
    // 初始化钩子
    this.frameworkComment = (opts && opts.frameworkComment) || '// {"framework" : "Rax"}'
  }
  addFrameworkComment(compilation: webpack.compilation.Compilation, chunk: webpack.compilation.Chunk) {
    chunk.files.forEach((file) => {
      compilation.assets[file] = new ConcatSource(
        this.frameworkComment,
        '\n',
        compilation.assets[file],
      )
    })
  }
  apply(compiler: webpack.Compiler) {
    // Webpack 4
    if (compiler.hooks && compiler.hooks.compilation && compiler.hooks.compilation.tap) {
      compiler.hooks.compilation.tap('WeexJsbundleFrameworkComment', (compilation) => {
        // uglify-webpack-plugin将删除在expandOunkAssets中的javascript注释，
        // 需要在AfterptimizeChunkAssets后使用，以便在此之后添加frameworkComment
        compilation.hooks.afterOptimizeChunkAssets.tap('WeexJsbundleFrameworkComment', (chunks) => {
          for (const chunk of chunks) {
            // 仅仅入口文件[Entry]
            if (!chunk.canBeInitial()) {
              continue
            }
            this.addFrameworkComment(compilation, chunk)
          }
        })
      })
    } else {
      compiler.plugin('compilation', (compilation) => {
        // uglify-webpack-plugin将删除在optimize-chunk-assets中的javascript注释，之后添加frameworkComment。
        compilation.plugin('after-optimize-chunk-assets', (chunks: webpack.compilation.Chunk[]) => {
          chunks.forEach((chunk: any) => {
            // 仅仅入口文件[Entry]
            try {
              // In webpack2 chunk.initial was removed. Use isInitial()
              if (!chunk.initial) {
                return
              }
            } catch (e) {
              if (!chunk.isInitial()) {
                return
              }
            }
            this.addFrameworkComment(compilation, chunk)
          })
        })
      })
    }
  }
}
export default WeexJsbundleFrameworkComment
