
import defaultsDeep from 'lodash/defaultsDeep'

export type getOptions<C> =
  C extends null ? C :
  C extends any[] ? C :
  C extends string ? C :
  C extends number ? C :
  C extends boolean ? C :
  C extends undefined ? C :
  C extends ((...args: any[]) => any | void) ? C :
  {
    [P in keyof C]?: getOptions<C[P]>;
  }

export type getOptionsNoVoid<C> =
  C extends void ? never :
  C extends any[] ? C :
  C extends string ? C :
  C extends number ? C :
  C extends boolean ? C :
  C extends ((...args: any[]) => any | void) ? C :
  {
    [P in keyof C]-?: getOptionsNoVoid<C[P]>;
  }

export function defaultsDeepClone<S extends any>(o: any, sources: S): S {
  return defaultsDeep(Object.assign(Object.create(null), o), sources)
}
