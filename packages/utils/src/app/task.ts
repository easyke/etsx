type fn = (...args: any[]) => any
export const sequence = <T extends any, R extends any>(tasks: T[], fn: (task: T) => R | Promise<R>): Promise<R> => {
  return tasks.reduce(
    (promise, task) => promise.then(() => fn(task)),
    (Promise.resolve() as any),
  )
}

export const parallel = <T extends any, R extends any>(tasks: T[], fn: (task: T) => R | Promise<R>): Promise<R[]> => {
  return Promise.all(tasks.map(fn))
}
type onFn = null | void | string | number | object | Array<null | void | string | number | object>;

export const createPromiseCallback = <R = any>(): {
  promise: Promise<R>;
  cb: (err: any, res?: R) => void;
} => {
  let resolve: (value?: R | PromiseLike<R>) => void
  let reject: (reason?: any) => void
  const promise: Promise<R> = new Promise((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })
  const cb = (err: any, res?: R) => {
    if (err) return reject(err)
    resolve(res)
  }
  return { promise, cb }
}

export const chainFn = <B extends onFn, BR extends any, FR extends any>(base: B | ((...args: any[]) => BR), fn: (...args: any[]) => FR): B | ((...args: any[]) => (BR | FR)) => {
  /* istanbul ignore if */
  if (typeof fn !== 'function') {
    return base
  }
  return function(this: any, ...args): BR | FR {
    if (typeof base !== 'function') {
      return fn.apply(this, args)
    }
    let baseResult = base.apply(this, args)
    // Allow function to mutate the first argument instead of returning the result
    if (baseResult === undefined) {
      [baseResult] = args
    }
    const fnResult = fn.call(
      this,
      baseResult,
      ...Array.prototype.slice.call(args, 1),
    )
    // Return mutated argument if no result was returned
    if (fnResult === undefined) {
      return baseResult
    }
    return fnResult
  }
}
