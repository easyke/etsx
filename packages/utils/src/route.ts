import path from 'path'
import get from 'lodash/get'
import { logger } from './logger'

// Guard dir1 from dir2 which can be indiscriminately removed
// 保护dir1来自dir2，可以不加选择地删除

export function guardDir<TObject extends object, TKey extends keyof TObject>(
  options: TObject | null | undefined,
  key1: TKey | [TKey],
  key2: TKey | [TKey],
): void {
  const dir1 = get(options, key1, false) as any
  const dir2 = get(options, key2, false) as any

  if (
    dir1 &&
    dir2 &&
    (
      dir1 === dir2 ||
      (
        (dir1 as string).startsWith(dir2 as string) &&
        !path.basename(dir1 as string).startsWith(path.basename(dir2 as string))
      )
    )
  ) {
    const errorMessage = `options.${key2} cannot be a parent of or same as ${key1}`
    logger.fatal(errorMessage)
    throw new Error(errorMessage)
  }
}
