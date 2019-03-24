export function encodeHtml(str: string): string {
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function isString(obj: string | any): boolean {
  return Boolean(typeof obj === 'string' || obj instanceof String)
}
export function isNonEmptyString(obj: string | any): boolean {
  return Boolean(obj && isString(obj))
}

export function isPureObject(o: object | any): boolean {
  return !Array.isArray(o) && typeof o === 'object'
}

export function isUrl(url: string): boolean {
  return ['http', '//'].some((str: string) => url.startsWith(str))
}

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
export function wrapArray<A>(value: A[] | A): A[] {
  return Array.isArray(value) ? value : [value]
}

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
