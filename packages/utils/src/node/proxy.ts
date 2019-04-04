export const proto: symbol = Symbol('prototype')
export const property: symbol = Symbol('propertys')
export function proxy<Propertys extends object, Prototype extends object, Options extends object>(
  prototype: Prototype,
  propertys: ((prototype: Prototype, options?: Options) => Propertys) | Propertys,
  options?: Options): Prototype & Propertys {
  propertys = typeof propertys === 'function' ? (propertys as (prototype: Prototype, options?: Options) => Propertys)(prototype, options) : (propertys || {})
  const properties = {} as { [key: string]: any }
  const keys = Object.getOwnPropertyNames(prototype).concat(Object.getOwnPropertyNames(propertys))
  if (Array.isArray(keys)) {
    keys.forEach((key: string) => {
      properties[key] = {
        get() {
          if (proxyObject[property] && Object.prototype.hasOwnProperty.call(proxyObject[property], key)) {
            if (typeof proxyObject[property][key] === 'function') {
              return proxyObject[property][key].bind(proxyObject)
            } else {
              return proxyObject[property][key]
            }
          }
          return proxyObject[proto] && proxyObject[proto][key]
        },
        set(value?: any) {
          delete proxyObject[key]
          proxyObject[key] = value
        },
        enumerable: true,
        configurable: true,
      }
    })
  }
  const proxyObject = Object.assign(Object.create(prototype, properties), {
    [proto]: prototype,
    [property]: propertys,
  })
  return proxyObject
}
