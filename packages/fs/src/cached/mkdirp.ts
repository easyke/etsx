import path from 'path'
import { getFileSystem } from './common'
import { name as PathLike } from './storage';
const _0777 = parseInt('0777', 8)

export type err = NodeJS.ErrnoException | null
export type made = PathLike | null | undefined
export type mode = number | null
export type fs = any
export type callback = (er: err, made?: made) => void
export type opts = {
  mode?: mode,
  fs?: fs,
}
export function mkdirpSync(this: fs, p: PathLike, opts: opts | mode | undefined, made?: made): made {
  if (!opts || typeof opts !== 'object') {
    opts = { mode: opts } as opts
  }

  let mode = opts.mode || null
  const xfs = getFileSystem.call(this, opts.fs)

  if (mode === undefined) {
    // tslint:disable-next-line:no-bitwise
    mode = _0777 & (~process.umask())
  }
  if (!made) made = null

  p = path.resolve(p as string)

  try {
    xfs.mkdirSync(p, mode)
    made = made || p
  } catch (err0) {
    switch (err0.code) {
      case 'ENOENT':
        made = mkdirpSync.call(this, path.dirname(p), opts, made)
        mkdirpSync.call(this, p, opts, made)
        break;

      // In the case of any other error, just see if there's a dir
      // there already.  If so, then hooray!  If not, then something
      // is borked.
      default:
        let stat;
        try {
          stat = xfs.statSync(p)
        } catch (err1) {
          throw err0
        }
        if (!stat.isDirectory()) throw err0
        break
    }
  }

  return made
  }
export function mkdirp(this: fs, p: PathLike, opts: opts | mode | undefined, f?: callback, made?: made) {
  if (typeof opts === 'function') {
    f = opts
    opts = {}
  } else if (!opts || typeof opts !== 'object') {
    opts = { mode: opts }
  }

  let mode = opts.mode
  const xfs = getFileSystem.call(this, opts.fs)

  if (mode === undefined) {
    // tslint:disable-next-line:no-bitwise
    mode = _0777 & (~process.umask())
  }
  if (!made) made = null

  const cb = f || (() => { })
  p = path.resolve(p as string)

  xfs.mkdir(p, mode, (er: err) => {
    if (!er) {
      made = made || p
      return cb(null, made)
    }
    switch (er.code) {
      case 'ENOENT':
        mkdirp.call(this, path.dirname(p as string), opts, (er: err, made?: made) => {
          if (er) {
            cb(er, made)
          } else {
            mkdirp.call(this, p, opts, cb, made)
          }
        })
        break

      // In the case of any other error, just see if there's a dir
      // there already.  If so, then hooray!  If not, then something
      // is borked.
      default:
        xfs.stat(p, (er2: err, stat: {isDirectory: () => boolean}) => {
          // if the stat fails, then that's super weird.
          // let the original error be the failure reason.
          if (er2 || !stat.isDirectory()) cb(er, made)
          else cb(null, made)
        })
        break
    }
  })
}
