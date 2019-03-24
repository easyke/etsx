async function promiseFinally<R extends any>(fn: Promise<R> | (() => Promise<R>), finalFn: () => any): Promise<R | void> {
  let result
  try {
    if (typeof fn === 'function') {
      result = await fn()
    } else {
      result = await fn
    }
  } finally {
    finalFn()
  }
  return result
}

export const timeout = function timeout(fn: Promise<any> | (() => Promise<any>), ms: number, msg?: string) {
  let timerId: NodeJS.Timeout
  const warpPromise = promiseFinally(fn, () => timerId && clearTimeout(timerId))
  const timerPromise = new Promise((resolve, reject) => {
    timerId = setTimeout(() => reject(new Error(msg)), ms)
  })
  return Promise.race([warpPromise, timerPromise])
}

export const sleep = function sleep(ms: number) {
  return new Promise((resolve: (value?: {} | PromiseLike<{}> | undefined) => void) => setTimeout(resolve, ms || 0))
}
export function deferRun(fn: (...args: any[]) => void, ...args: any[]) {
  if (typeof setImmediate === 'function') {
    setImmediate(fn)
  } else {
    process.nextTick(fn)
  }
}
export const waitFor = sleep
type name = string;
type hrtime = [number, number];
type start = bigint | hrtime;
type time = {
  name: name;
  description: any;
  start: start;
}
export const times = Symbol('times')
export class Timer {
  [times]: Map;
  constructor() {
    this[times] = new Map()
  }

  start(name: name, description: any) {
    const time: time = {
      name,
      description,
      start: (this.hrtime() as start),
    }
    this[times].set(name, time)
    return time
  }

  end(name: name) {
    if (this[times].has(name)) {
      const time = this[times].get(name)
      time.duration = this.hrtime(time.start)
      this[times].delete(name)
      return time
    }
  }

  hrtime(start?: bigint | hrtime): number | bigint | hrtime {
    const useBigInt = typeof process.hrtime.bigint === 'function'
    if (start) {
      const end = useBigInt ? process.hrtime.bigint() : process.hrtime((start as hrtime))
      return useBigInt
        ? ((end as bigint) - (start as bigint)) / BigInt(1000000)
        : ((end as hrtime)[0] * 1e3) + ((end as hrtime)[1] * 1e-6)
    }
    return useBigInt ? process.hrtime.bigint() : process.hrtime()
  }

  clear() {
    this[times].clear()
  }
}
