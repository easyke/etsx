import webpack from 'webpack'
import Watchpack from 'watchpack'

const objectToMap = <V extends any>(obj: { [x: string]: V }): Map<string, V> => {
  return new Map(
    Object.keys(obj).map((key) => {
      const pair = [key, obj[key]];
      return pair;
    }) as any,
  );
};
export class NodeWatchFileSystem {
  watcher: Watchpack;
  watcherOptions: Watchpack.WatcherOptions;
  inputFileSystem: webpack.InputFileSystem;
  constructor(inputFileSystem: webpack.InputFileSystem) {
    this.inputFileSystem = inputFileSystem;
    this.watcherOptions = {
      aggregateTimeout: 0,
    };
    this.watcher = new Watchpack(this.watcherOptions);
  }

  watch(
    files: string[],
    dirs: string[],
    missing: string[],
    startTime: number,
    options: Watchpack.WatcherOptions,
    callback: (
      err: null,
      files: string[],
      dirs: string[],
      missing: string[],
      times1: Map<string, number>,
      times2: Map<string, number>,
      removals: string[],
    ) => void,
    callbackUndelayed: (item: string, mtime: number, file?: string) => void,
  ) {
    if (!Array.isArray(files)) {
      throw new Error("Invalid arguments: 'files'");
    }
    if (!Array.isArray(dirs)) {
      throw new Error("Invalid arguments: 'dirs'");
    }
    if (!Array.isArray(missing)) {
      throw new Error("Invalid arguments: 'missing'");
    }
    if (typeof callback !== "function") {
      throw new Error("Invalid arguments: 'callback'");
    }
    if (typeof startTime !== "number" && startTime) {
      throw new Error("Invalid arguments: 'startTime'");
    }
    if (typeof options !== "object") {
      throw new Error("Invalid arguments: 'options'");
    }
    if (typeof callbackUndelayed !== "function" && callbackUndelayed) {
      throw new Error("Invalid arguments: 'callbackUndelayed'");
    }
    const oldWatcher = this.watcher;
    this.watcher = new Watchpack(options);

    if (callbackUndelayed) {
      this.watcher.once("change", callbackUndelayed);
    }
    const cachedFiles = files;
    const cachedDirs = dirs;
    this.watcher.once("aggregated", (changes: string[], removals: string[]) => {
      changes = changes.concat(removals);
      if (this.inputFileSystem && this.inputFileSystem.purge) {
        (this.inputFileSystem as any).purge(changes);
      }
      const times: Map<string, number> = objectToMap(this.watcher.getTimes());
      const filesSet = new Set(files);
      const dirsSet = new Set(dirs);
      const missingSet = new Set(missing);
      removals = new Set(removals.filter((file) => filesSet.has(file)));
      callback(
        null,
        changes.filter((file) => filesSet.has(file)).sort(),
        changes.filter((file) => dirsSet.has(file)).sort(),
        changes.filter((file) => missingSet.has(file)).sort(),
        times,
        times,
        removals,
      );
    });

    this.watcher.watch(
      cachedFiles.concat(missing),
      cachedDirs.concat(missing),
      startTime,
    );

    if (oldWatcher) {
      oldWatcher.close();
    }
    return {
      close: () => {
        if (this.watcher) {
          this.watcher.close();
          this.watcher = null;
        }
      },
      pause: () => {
        if (this.watcher) {
          this.watcher.pause();
        }
      },
      getFileTimestamps: () => {
        if (this.watcher) {
          return objectToMap(this.watcher.getTimes());
        } else {
          return new Map();
        }
      },
      getContextTimestamps: () => {
        if (this.watcher) {
          return objectToMap(this.watcher.getTimes());
        } else {
          return new Map();
        }
      },
    };
  }
}
export default NodeWatchFileSystem
