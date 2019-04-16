import { logger, timeout } from '@etsx/utils'

export type jsdomOpts = {
  virtualConsole?: boolean;
}
export type renderOpts = {
  loadedCallback: string;
  loadingTimeout?: number;
  globals?: any;
}

export async function renderAndGetWindow(
  url: string = 'http://localhost:3000',
  jsdomOpts: jsdomOpts = {},
  {
    loadedCallback,
    loadingTimeout = 2000,
    globals,
  }: renderOpts = {
      loadedCallback: 'onload',
    },
) {
  let jsdom
  try {
    jsdom = require('jsdom')
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      logger.error(`
        jsdom is not installed. Please install jsdom with:
        $ yarn add --dev jsdom
        OR
        $ npm install --dev jsdom
      `)
    }
    throw e
  }

  const options = Object.assign({
    // Load subresources (https://github.com/tmpvar/jsdom#loading-subresources)
    resources: 'usable',
    runScripts: 'dangerously',
    virtualConsole: true,
    beforeParse(window: Window) {
      // Mock window.scrollTo
      window.scrollTo = () => { }
    },
  }, jsdomOpts)

  const jsdomErrHandler = (err: Error | any) => {
    throw err
  }

  if (options.virtualConsole) {
    if (options.virtualConsole === true) {
      options.virtualConsole = new jsdom.VirtualConsole().sendTo(logger)
    }
    // Throw error when window creation failed
    (options.virtualConsole as any).on('jsdomError', jsdomErrHandler)
  }

  const { window } = await jsdom.JSDOM.fromURL(url, options)

  // If Project could not be loaded (error from the server-side)
  const projectExists = window.document.body.innerHTML.includes(`window.${globals.context}`)

  /* istanbul ignore if */
  if (!projectExists) {
    interface IBodyError extends Error {
      body: string;
    }
    const error = new Error('Could not load the project app') as IBodyError
    error.body = window.document.body.innerHTML
    throw error
  }

  // Used by Project.js to say when the components are loaded and the app ready
  await timeout(new Promise((resolve) => {
    window[loadedCallback] = () => resolve(window)
  }), loadingTimeout, `Components loading in renderAndGetWindow was not completed in ${loadingTimeout / 1000}s`)

  if (options.virtualConsole) {
    // After window initialized successfully
    (options.virtualConsole as any).removeListener('jsdomError', jsdomErrHandler)
  }

  // Send back window object
  return window
}
