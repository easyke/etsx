export type name = string | Buffer | URL
export type level = Set<name>
export type err = NodeJS.ErrnoException | Error | null
export type result = any
export type callback = (err: err, result?: result) => void
export type provider = (name?: name, callback?: callback) => void
export type provideSync = (name: name) => result
export class Storage {
  duration: number;
  running: Map<name, callback[]>;
  data: Map<name, [err, any]>;
  levels: level[];
  count: number;
  interval: NodeJS.Timeout|null;
  needTickCheck: boolean;
  nextTick: number|null;
  passive: boolean;
  constructor(duration: number) {
    this.duration = duration;
    this.running = new Map();
    this.data = new Map();
    this.levels = [];
    if (duration > 0) {
      this.levels.push(new Set(), new Set(), new Set(), new Set(), new Set(), new Set(), new Set(), new Set(), new Set());
      for (let i = 8000; i < duration; i += 500)
        this.levels.push(new Set());
    }
    this.count = 0;
    this.interval = null;
    this.needTickCheck = false;
    this.nextTick = null;
    this.passive = true;
    this.tick = this.tick.bind(this);
  }

  ensureTick() {
    if (!this.interval && this.duration > 0 && !this.nextTick)
      this.interval = setInterval(this.tick, Math.floor(this.duration / this.levels.length));
  }

  finished(name: name, err: err, result: result) {
    const callbacks = this.running.get(name);
    this.running.delete(name);
    if (this.duration > 0) {
      this.data.set(name, [err, result]);
      const levelData = this.levels[0];
      this.count -= levelData.size;
      levelData.add(name);
      this.count += levelData.size;
      this.ensureTick();
    }
    if (callbacks) {
      callbacks.forEach((callback: callback) => callback(err, result))
    }
  }

  finishedSync(name: name, err: err, result?: result) {
    if (this.duration > 0) {
      this.data.set(name, [err, result]);
      const levelData = this.levels[0];
      this.count -= levelData.size;
      levelData.add(name);
      this.count += levelData.size;
      this.ensureTick();
    }
  }

  provide(provider: provider, name: name, callback: callback) {
    if (typeof name !== "string") {
      callback(new TypeError("path must be a string"));
      return;
    }
    const args = Array.prototype.slice.call(arguments)
    callback = args.splice(-1, 1)[0]
    args.splice(0, 1)
    let running = this.running.get(name);
    if (running) {
      running.push(callback);
      return;
    }
    if (this.duration > 0) {
      this.checkTicks();
      const data = this.data.get(name);
      if (data) {
        return process.nextTick(() => {
          callback.apply(null, data);
        });
      }
    }
    this.running.set(name, running = [callback]);
    args.push((err: err, result: result) => {
      this.finished(name, err, result);
    })
    provider(...args);
  }

  provideSync(name: name, provider: provideSync) {
    if (typeof name !== "string") {
      throw new TypeError("path must be a string");
    }
    if (this.duration > 0) {
      this.checkTicks();
      const data = this.data.get(name);
      if (data) {
        if (data[0])
          throw data[0];
        return data[1];
      }
    }
    let result;
    try {
      result = provider(name);
    } catch (e) {
      this.finishedSync(name, e);
      throw e;
    }
    this.finishedSync(name, null, result);
    return result;
  }

  tick() {
    const decay = this.levels.pop();
    if (!decay) {
      return true;
    }
    for (const item of decay) {
      this.data.delete(item);
    }
    this.count -= decay.size;
    decay.clear();
    this.levels.unshift(decay);
    if (this.count === 0) {
      clearInterval(this.interval as NodeJS.Timeout);
      this.interval = null;
      this.nextTick = null;
      return true;
    } else if (this.nextTick) {
      this.nextTick += Math.floor(this.duration / this.levels.length);
      const time = new Date().getTime();
      if (this.nextTick > time) {
        this.nextTick = null;
        this.interval = setInterval(this.tick, Math.floor(this.duration / this.levels.length));
        return true;
      }
    } else if (this.passive) {
      clearInterval(this.interval as NodeJS.Timeout);
      this.interval = null;
      this.nextTick = new Date().getTime() + Math.floor(this.duration / this.levels.length);
    } else {
      this.passive = true;
    }
  }

  checkTicks() {
    this.passive = false;
    if (this.nextTick) {
      while (!this.tick());
    }
  }

  purge(what?: name | name[]) {
    if (!what) {
      this.count = 0;
      clearInterval(this.interval as NodeJS.Timeout);
      this.nextTick = null;
      this.data.clear();
      this.levels.forEach((level: level) => {
        level.clear();
      });
    } else if (typeof what === "string") {
      for (const key of this.data.keys()) {
        if ((key as string).startsWith(what))
          this.data.delete(key);
      }
    } else if (Array.isArray(what)) {
      for (let i = what.length - 1; i >= 0; i--) {
        this.purge(what[i]);
      }
    }
  }
}
export default Storage
