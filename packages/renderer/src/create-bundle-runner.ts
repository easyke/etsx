import vm from 'vm'
import path from 'path'
import resolve from 'resolve'
import NativeModule from 'module';

export type userContext = any
export type initialContext = any
export type globalSandbox = {
  Buffer: any,
  console: any,
  process: any,
  setTimeout: any,
  setInterval: any,
  setImmediate: any,
  clearTimeout: any,
  clearInterval: any,
  clearImmediate: any,
  __ETSX_SSR_CONTEXT__: initialContext,
  global: globalSandbox,
}
export type runInNewContext = boolean | 'once';
export type entry = string;
export type files = {
  [fileName: string]: string | Buffer;
};
export type evaluatedFiles = {
  [filename: string]: any;
}

function createGlobalSandbox(context?: any): globalSandbox {
  const sandbox: globalSandbox = {
    Buffer,
    console,
    process,
    setTimeout,
    setInterval,
    setImmediate,
    clearTimeout,
    clearInterval,
    clearImmediate,
    __ETSX_SSR_CONTEXT__: context,
  } as any
  sandbox.global = sandbox
  return sandbox
}

function compileModule(files: files, basedir: string, runInNewContext: runInNewContext = true): (filename: string, sandbox: globalSandbox, evaluatedFiles?: evaluatedFiles) => any {
  const compiledScripts: { [filename: string]: vm.Script; } = {}
  const resolvedModules: { [filename: string]: string; } = {}

  function getCompiledScript(filename: string) {
    if (compiledScripts[filename]) {
      return compiledScripts[filename]
    }
    const code = files[filename]
    const wrapper = NativeModule.wrap(typeof code === 'string' ? code : String(code))
    const script = new vm.Script(wrapper, {
      filename,
      displayErrors: true,
    })
    compiledScripts[filename] = script
    return script
  }

  function evaluateModule(filename: string, sandbox: globalSandbox, evaluatedFiles: evaluatedFiles = {}): any {
    if (evaluatedFiles[filename]) {
      return evaluatedFiles[filename]
    }

    const script = getCompiledScript(filename)
    const compiledWrapper = runInNewContext === false
      ? script.runInThisContext()
      : script.runInNewContext(sandbox)
    const m = { exports: {} }
    const r = (file: string) => {
      file = path.posix.join('.', file)
      if (files[file]) {
        return evaluateModule(file, sandbox, evaluatedFiles)
      } else if (basedir) {
        return require(
          resolvedModules[file] ||
          (resolvedModules[file] = resolve.sync(file, { basedir })),
        )
      } else {
        return require(file)
      }
    }
    compiledWrapper.call(m.exports, m.exports, r, m)

    const res = Object.prototype.hasOwnProperty.call(m.exports, 'default') ? (m.exports as any).default : m.exports;
    evaluatedFiles[filename] = res
    return res
  }
  return evaluateModule
}

export function createBundleRunner(entry: entry, files: files, basedir: string, runInNewContext: runInNewContext = true): (userContext?: userContext) => Promise<any> {
  const evaluate = compileModule(files, basedir, runInNewContext)
  if (runInNewContext !== false && runInNewContext !== 'once') {
    // new context mode: creates a fresh context and re-evaluate the bundle
    // on each render. Ensures entire application state is fresh for each
    // render, but incurs extra evaluation cost.
    return (userContext: userContext = {}) => new Promise((resolve) => {
      userContext._registeredComponents = new Set()
      const sandbox = createGlobalSandbox()
      const res = evaluate(entry, sandbox)
      delete sandbox.__ETSX_SSR_CONTEXT__
      resolve(typeof res === 'function' ? res(userContext) : res)
    })
  } else {
    // direct mode: instead of re-evaluating the whole bundle on
    // each render, it simply calls the exported function. This avoids the
    // module evaluation costs but requires the source code to be structured
    // slightly differently.
    let runner: any // lazy creation so that errors can be caught by user
    return (userContext: userContext = {}) => new Promise((resolve) => {
      if (!runner) {
        const sandbox: globalSandbox = runInNewContext === 'once' ? createGlobalSandbox() : global as any;
        // the initial context is only used for collecting possible non-component
        // styles injected by vue-style-loader.
        sandbox.__ETSX_SSR_CONTEXT__ = {}
        runner = evaluate(entry, sandbox)
        // On subsequent renders, __ETSX_SSR_CONTEXT__ will not be available
        // to prevent cross-request pollution.
        delete sandbox.__ETSX_SSR_CONTEXT__
        if (typeof runner !== 'function') {
          throw new Error(
            `bundle export should be a function when using { runInNewContext: ${runInNewContext} }.`,
          )
        }
      }
      userContext._registeredComponents = new Set()

      resolve(runner(userContext))
    })
  }
}
