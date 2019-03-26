export const encodeHtml = (str: string) => str.replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const isString = (obj: any) => Boolean(typeof obj === 'string' || obj instanceof String)

export const isEmpty = (v: any) => v === undefined || v === null

export const isNonEmptyString = (obj: any) => Boolean(obj && isString(obj))

export const isPureObject = (o: any) => !Array.isArray(o) && typeof o === 'object'

export const isUrl = (url: string) => ['http', '//'].some((str: string) => url.startsWith(str))

export function urlJoin(): string {
  return [].slice
    .call(arguments)
    .join('/')
    .replace(/\/+/g, '/')
    .replace(':/', '://')
}

/**
 * Wraps value in array if it is not already an array
 *
 * @param  {any} value
 * @return {array}
 */
export const wrapArray = <A extends any>(value: A[] | A): A[] => Array.isArray(value) ? value : [value]

const WHITESPACE_REPLACEMENTS = [
  [/[ \t\f\r]+\n/g, '\n'], // strip empty indents
  [/{\n{2,}/g, '{\n'], // strip start padding from blocks
  [/\n{2,}([ \t\f\r]*})/g, '\n$1'], // strip end padding from blocks
  [/\n{3,}/g, '\n\n'], // strip multiple blank lines (1 allowed)
  [/\n{2,}$/g, '\n'], // strip blank lines EOF (0 allowed)
]

export function stripWhitespace<S extends string>(string: S): S {
  WHITESPACE_REPLACEMENTS.forEach(([regex, newSubstr]) => {
    string = string.replace(regex, newSubstr as string) as S
  })
  return string
}
