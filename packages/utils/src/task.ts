type fn = (...args: any[]) => any
export const sequence = <T extends any, R extends any>(tasks: T[], fn: (task: T) => R | Promise<R>): R => {
  return tasks.reduce(
    (promise, task) => promise.then(() => fn(task)),
    (Promise.resolve() as any),
  )
}

export const parallel = <T extends any, R extends any>(tasks: T[], fn: (task: T) => R | Promise<R>): Promise<R[]> => {
  return Promise.all(tasks.map(fn))
}

export const chainFn = (base: any, fn: any) => {
  /* istanbul ignore if */
  if (typeof fn !== 'function') {
    return base
  }
  return function(this: any): any {
    if (typeof base !== 'function') {
      return fn.apply(this, arguments as IArguments)
    }
    let baseResult = base.apply(this, arguments as IArguments)
    // Allow function to mutate the first argument instead of returning the result
    if (baseResult === undefined) {
      baseResult = arguments[0]
    }
    const fnResult = fn.call(
      this,
      baseResult,
      ...Array.prototype.slice.call(arguments as IArguments, 1),
    )
    // Return mutated argument if no result was returned
    if (fnResult === undefined) {
      return baseResult
    }
    return fnResult
  }
}
