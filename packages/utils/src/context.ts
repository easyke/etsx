import { listener } from '@etsx/listener'

export type global = string | ((globalName: string) => string);
export type globals = {
  [key: string]: global;
  id: global;
  etsx: global;
  context: global;
  pluginPrefix: global;
  readyCallback: global;
  loadedCallback: global;
}
export function getContext<Q extends listener.Request, S extends listener.Response>(req: Q, res: S): { req: Q, res: S } {
  return { req, res }
}
export const determineGlobals = function determineGlobals(globalName: string = 'etsx', globals: globals) {
  const _globals: { [key in keyof globals]?: string } = {}
  Object.keys(globals).forEach((global) => {
    const item = globals[global]
    if (typeof item === 'function') {
      _globals[global] = item(globalName)
    } else {
      _globals[global] = (globals[global] as string)
    }
  })
  return _globals as { [key in keyof globals]: string }
}
