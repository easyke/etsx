import { options, EtsxOptions } from './options'
export * from './options'
export function getDefaultEtsxConfig(options: options = {}): EtsxOptions {
  return new EtsxOptions(options)
}
export default EtsxOptions
