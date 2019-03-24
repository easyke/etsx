import path from 'path'
import { sleep, stdEnv } from '@etsx/utils'
import { getFileSystem, isFileSystem } from './common'
import { name as PathLike, err } from './storage';
import { cachedFileSystem, Stats } from './'

export type result = any
export type callback = (err: err, result?: result) => void

export function remove(this: cachedFileSystem, p: PathLike, ifs: cachedFileSystem, cb: callback) {
  if (typeof ifs === 'function' && !isFileSystem(ifs)) {
    cb = ifs
    ifs = this || ifs
  }
  if (typeof cb === 'function') {
    return removePromise.call(this, p, ifs).then((res: result) => cb(null, res), (e: err) => cb(e, null))
  } else {
    return removePromise.call(this, p, ifs)
  }
}
function removePromise(this: cachedFileSystem | any, p: PathLike, ifs?: cachedFileSystem, maxBusyTries: number = 3) {
  if (!p || typeof p !== 'string') {
    throw new Error('remove: path should be a string')
  }
  const fs = isFileSystem(ifs) ? ifs as cachedFileSystem : getFileSystem.call(this, ifs) as cachedFileSystem

  let busyTries = 0
  return removePromiseRun(p, fs).catch((error: NodeJS.ErrnoException) => {

    if ((error.code === 'EBUSY' || error.code === 'ENOTEMPTY' || error.code === 'EPERM') &&
      busyTries < maxBusyTries) {
      busyTries++
      const time = busyTries * 100
      // try again, with the same exact callback as this one.
      return sleep(time).then(() => removePromiseRun(p, fs))
    } else if (error.code !== 'ENOENT') {
      // 如果不是已经删除这个提交，就把错误重新抛出
      return Promise.reject(error)
    }
  })
}
// Two possible strategies.
// 1. Assume it's a file.  unlink it, then do the dir stuff on EPERM or EISDIR
// 2. Assume it's a directory.  readdir, then do the file stuff on ENOTDIR
//
// Both result in an extra syscall when you guess wrong.  However, there
// are likely far more normal files in the world than directories.  This
// is based on the assumption that a the average number of files per
// directory is >= 1.
//
// If anyone ever complains about this, then I guess the strategy could
// be made configurable somehow.  But until then, YAGNI.

async function removePromiseRun(p: PathLike, fs: cachedFileSystem) {
  try {
    const st = await new Promise<Stats>((resolve, reject) => {
      type lfs = cachedFileSystem & {
        lstat: cachedFileSystem['stat'];
      };
      ((fs as lfs).lstat || fs.stat)(p, (e: err, res) => e ? reject(e) : resolve(res))
    })
    if (st && st.isDirectory()) {
      return rmdir(p, fs, null)
    } else {
      return new Promise((resolve, reject) => {
        fs.unlink(p, (er, res) => er ? reject(er) : resolve(res))
      })
    }
  } catch (er) {
    if (er.code === 'ENOENT') {
      // 如果📃文件或者📂文件夹不存在，直接结束
      return
    } else if (er.code === 'EPERM') {
      // Windows can EPERM on stat.  Life is suffering.
      // Windows可以在stat上进行EPERM。 生活是痛苦的。
      if (stdEnv.isWindows) {
        type cfs = cachedFileSystem & {
          chmod(p: PathLike, mode: number, cb: (er2: NodeJS.ErrnoException) => void): void;
        };
        if ((fs as cfs).chmod) {
          await new Promise((resolve, reject) => {
            (fs as cfs).chmod(p, 0o666, (er2) => {
              if (er2) {
                er2.code === 'ENOENT' ? resolve() : reject(er)
              } else {
                fs.stat(p, (er3, stats) => {
                  if (er3 || !stats) {
                    er3 && (er3 as NodeJS.ErrnoException).code === 'ENOENT' ? resolve() : reject(er)
                  } else if (stats.isDirectory()) {
                    rmdir(p, fs, er).then(resolve, reject)
                  } else {
                    fs.unlink(p, (e, res) => e ? reject(er || e) : resolve(res))
                  }
                })
              }
            })
          })
        } else {
          throw er
        }
      } else {
        await rmdir(p, fs, er)
      }
    } else if (er.code !== 'EISDIR') {
      throw er
    } else {
      await rmdir(p, fs, er)
    }
  }
}

function fixWinEPERMSync(p: PathLike, fs: cachedFileSystem, originalEr: err) {
  if (!p || typeof p !== 'string') {
    throw new Error('remove: path should be a string')
  } else if (!isFileSystem(fs)) {
    throw new Error('没有传入文件系统')
  } else if (!(originalEr instanceof Error)) {
    throw new Error('er no instanceof Error')
  }
  type cfs = cachedFileSystem & {
    chmodSync(p: PathLike, mode: number): void;
  };
  if (typeof (fs as cfs).chmodSync === 'function') {
    try {
      (fs as cfs).chmodSync(p, 0o666)
    } catch (er2) {
      // 权限修改失败的时候
      if (er2.code === 'ENOENT') {
        // 如果📃文件或者📂文件夹不存在，直接结束
        return
      } else {
        throw originalEr
      }
    }
  } else {
    throw originalEr
  }

  try {
    const stats = fs.statSync(p)
    if (stats.isDirectory()) {
      rmdirSync(p, fs, originalEr)
    } else {
      fs.unlinkSync(p)
    }
  } catch (er3) {
    if (er3.code === 'ENOENT') {
      return
    } else {
      throw originalEr
    }
  }
}

function rmdir(p: PathLike, fs: cachedFileSystem, originalEr?: err) {
  if (!p || typeof p !== 'string') {
    return Promise.reject(new Error('remove: path should be a string'))
  } else if (!isFileSystem(fs)) {
    return Promise.reject(new Error('没有传入文件系统'))
  }
  // try to rmdir first, and only readdir on ENOTEMPTY or EEXIST (SunOS)
  // if we guessed wrong, and it's not a directory, then
  // raise the original error.
  return new Promise((resolve, reject) => {
    fs.rmdir(p, (er) => {
      if (er) {
        if ((
          (er as NodeJS.ErrnoException).code === 'ENOTEMPTY' ||
          (er as NodeJS.ErrnoException).code === 'EEXIST' ||
          (er as NodeJS.ErrnoException).code === 'EPERM'
        )) {
          fs.readdir(p, (er, files) => {
            if (er) {
              return reject(er)
            } else if (files.length === 0) {
              fs.rmdir(p, (er) => er ? reject(er) : resolve())
            } else {
              Promise.all(files.map((file: string) => removePromise(path.join(p, file), fs))).then(() => {
                fs.rmdir(p, (er) => er ? reject(er) : resolve())
              }, reject)
            }
          })
        } else if ((er as NodeJS.ErrnoException).code === 'ENOTDIR') {
          return reject(originalEr || er)
        } else {
          return reject(er)
        }
      } else {
        resolve()
      }
    })
  })
}

// this looks simpler, and is strictly *faster*, but will
// tie up the JavaScript thread and fail on excessively
// deep directory trees.
export function removeSync(this: cachedFileSystem | any, p: PathLike, ifs?: cachedFileSystem): void {
  if (!p || typeof p !== 'string') {
    throw new Error('remove: path should be a string')
  }
  const fs = isFileSystem(ifs) ? ifs as cachedFileSystem : getFileSystem.call(this, ifs) as cachedFileSystem
  let st
  try {
    type lfs = cachedFileSystem & {
      lstatSync: cachedFileSystem['statSync'];
    };
    st = ((fs as lfs).lstatSync || fs.statSync)(p)
  } catch (er) {
    if (er.code === 'ENOENT') {
      // 如果📃文件或者📂文件夹不存在，直接结束
      return
    } else if (er.code === 'EPERM' && stdEnv.isWindows) {
      // Windows can EPERM on stat.  Life is suffering.
      // Windows可以在stat上进行EPERM。 生活是痛苦的。
      fixWinEPERMSync(p, fs, er)
    }
  }

  try {
    // sunos让root用户取消链接目录，这很奇怪。
    if (st && st.isDirectory()) {
      // 只有是目录的时候才会使用目录删除
      rmdirSync(p, fs, null)
    } else {
      // 删除文件或者软连接
      fs.unlinkSync(p)
    }
  } catch (er) {
    if (er.code === 'ENOENT') {
      return
    } else if (er.code === 'EPERM') {
      return stdEnv.isWindows ? fixWinEPERMSync(p, fs, er) : rmdirSync(p, fs, er)
    } else if (er.code !== 'EISDIR') {
      throw er
    } else {
      return rmdirSync(p, fs, er)
    }
  }
}

function rmdirSync(p: string, fs: cachedFileSystem, originalEr: err = null) {
  if (!p || typeof p !== 'string') {
    throw new Error('remove: path should be a string')
  } else if (!isFileSystem(fs)) {
    throw new Error('没有传入文件系统')
  }

  try {
    // 试图删除文件夹目录
    fs.rmdirSync(p)
  } catch (er) {
    if (er.code === 'ENOTDIR') {
      // 不存在目录
      throw (originalEr || er)
    } else if (er.code === 'ENOTEMPTY' || er.code === 'EEXIST' || er.code === 'EPERM') {
      // 需要先进一步递归删除 子目录
      fs.readdirSync(p).forEach((f: string) => removeSync(path.join(p, f), fs))
      // 子目录删除后 再次重试删除本目录
      if (stdEnv.isWindows) {
        // We only end up here once we got ENOTEMPTY at least once, and
        // at this point, we are guaranteed to have removed all the kids.
        // So, we know that it won't be ENOENT or ENOTDIR or anything else.
        // try really hard to delete stuff on windows, because it has a
        // PROFOUNDLY annoying habit of not closing handles promptly when
        // files are deleted, resulting in spurious ENOTEMPTY errors.
        const startTime = Date.now()
        do {
          try {
            return fs.rmdirSync(p)
          } catch (er) { }
        } while (Date.now() - startTime < 500) // give up after 500ms
      } else {
        return fs.rmdirSync(p)
      }
    } else if (er.code !== 'ENOENT') {
      // 目录如果不是不存在就把错误再次抛出
      throw er
    }
  }
}
