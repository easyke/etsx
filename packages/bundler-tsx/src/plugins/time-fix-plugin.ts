import webpack from 'webpack'
type watchOffset = number;
export class TimeFixPlugin {
  watchOffset: watchOffset;
  constructor(watchOffset = 11000) {
    this.watchOffset = watchOffset
  }

  apply(compiler: webpack.Compiler) {
    const context = this
    const watch = compiler.watch
    let watching: webpack.Compiler.Watching

    // Modify the time for first run
    compiler.watch = function() {
      watching = watch.apply(this, arguments as any);
      (watching as any).startTime += context.watchOffset
      return watching
    }

    // Modify the time for subsequent runs
    compiler.hooks.watchRun.tap('time-fix-plugin', () => {
      if (watching) {
        (watching as any).startTime += this.watchOffset
      }
    })

    // Reset time
    compiler.hooks.done.tap('time-fix-plugin', (stats) => {
      if (watching) {
        (stats as any).startTime -= this.watchOffset
      }
    })
  }
}
export default TimeFixPlugin
