import path from 'path';
import Storage, * as storage from './storage';
import { mkdirp, mkdirpSync, made as mkdirpMade } from './mkdirp';
import { remove, removeSync } from './remove';

type PathLike = storage.name
export type Stats = {
  isFile(): boolean;
  isDirectory(): boolean;
  isBlockDevice(): boolean;
  isCharacterDevice(): boolean;
  isSymbolicLink(): boolean;
  isFIFO(): boolean;
  isSocket(): boolean;
  dev: number;
  ino: number;
  mode: number;
  nlink: number;
  uid: number;
  gid: number;
  rdev: number;
  size: number;
  blksize: number;
  blocks: number;
  atimeMs: number;
  mtimeMs: number;
  ctimeMs: number;
  birthtimeMs: number;
  atime: Date;
  mtime: Date;
  ctime: Date;
  birthtime: Date;
}
export type options = {
  duration?: number;
  cacheMethod?: string;
  upathMethod?: string;
  purgeMethod?: string;
}
export type propertys = {

  meta: (_path: PathLike) => any;

  existsSync(_path: PathLike): boolean;

  statSync(_path: PathLike): Stats;

  readFileSync(_path: PathLike, encoding?: string): any;

  readdirSync(_path: PathLike): string[];

  mkdirpSync(_path: PathLike, opts?: object, made?: number): void;

  mkdirSync(_path: PathLike): void;

  rmdirSync(_path: PathLike): void;

  unlinkSync(_path: PathLike): void;

  readlinkSync(_path: PathLike): string;

  writeFileSync(_path: PathLike, content: string | Buffer, encoding?: string): void;

  createReadStream(
    path: string, options?: {
      start: number;
      end: number;
    },
  ): any;

  createWriteStream(path: PathLike, options?: any): any;

  exists(path: PathLike, callback: (isExist: boolean) => void): void;

  writeFile(path: PathLike, content: string | Buffer, callback: (err: Error | undefined) => void): void;

  writeFile(path: PathLike, content: string | Buffer, encoding: string, callback: (err: Error | undefined) => void): void;

  join(...paths: string[]): string;
  join(path: PathLike, request: string): string;

  pathToArray(path: PathLike): string[];

  normalize(path: PathLike): string;

  stat(path: PathLike, callback: (err: storage.err, result?: Stats) => void): void;

  readdir(path: PathLike, callback: (err: storage.err, result?: any) => void): void;

  mkdirp(path: PathLike, callback: (err: storage.err, result?: any) => void): void;
  mkdirp(path: PathLike, opts?: object, callback?: storage.callback, made?: number): void;

  rmdir(path: PathLike, callback: (err: storage.err, result?: any) => void): void;

  unlink(path: PathLike, callback: (err: storage.err, result?: any) => void): void;

  readlink(path: PathLike, callback: (err: storage.err, result?: any) => void): void;

  mkdir(path: PathLike, callback: (err: storage.err) => void): void;
  mkdir(path: PathLike, optArg: {}, callback: (err: storage.err, result?: any) => void): void;

  readFile(path: PathLike, callback: (err: storage.err, result?: any) => void): void;
  readFile(path: PathLike, optArg: {}, callback: (err: storage.err, result?: any) => void): void;

  remove(p: PathLike, f: storage.callback): void;
  removeSync(p: PathLike): void;
  purge(what?: string | string[]): void;
}
export type cachedFileSystem = propertys
export function cachedFileSystem(fs: any, options?: options): propertys {
  if (!options) {
    options = {}
  }
  // 构建缓存
  const storages: Set<Storage> = new Set()
  // 构建返回
  const propertys = Object.create(null)
  // 缓存总数
  const duration = options.duration || 6000
  // 缓存这些方法的数据
  const cacheMethod = options.cacheMethod || 'lstat stat readFile readJson readlink'
  // 更新这些方法处理过的path
  const upathMethod = options.upathMethod || 'write writeFile appendFile truncate'
  // 这些方法会触发全部缓存回收
  const purgeMethod = options.purgeMethod || 'access chmod lchmod chown link rename copyFile symlink mkdir rmdir unlink utimes'

  const cacheMethodArray = typeof cacheMethod === 'string' ? cacheMethod.split(' ') : cacheMethod
  const upathMethodArray = typeof upathMethod === 'string' ? upathMethod.split(' ') : upathMethod
  const purgeMethodArray = typeof purgeMethod === 'string' ? purgeMethod.split(' ') : purgeMethod

  propertys.purge = purge
  if (!fs.remove) {
    propertys.remove = function(p: PathLike, f: storage.callback) {
      remove.call(this, p, this, f)
    }
  }
  if (!fs.removeSync) {
    propertys.removeSync = function(p: PathLike) {
      removeSync.call(this, p, this)
    }
  }
  if (!fs.mkdirp) {
    propertys.mkdirp = function(p: PathLike, opts?: object, f?: storage.callback, made?: mkdirpMade) {
      mkdirp.call(this, p, opts, f, made)
    }
  }
  if (!fs.mkdirpSync) {
    propertys.mkdirpSync = function(p: PathLike, opts?: object, made?: mkdirpMade) {
      mkdirpSync.call(this, p, opts, made)
    }
  }
  if (!fs.join) {
    propertys.join = path.join.bind(path)
  }

  if (fs.readdir || fs.readdirSync) {
    const storage = new Storage(duration)
    storages.add(storage)
    if (fs.readdir) {
      propertys.readdir = function readdir(path: PathLike, options?: object, callback?: storage.callback) {
        const args = Array.prototype.slice.call(arguments) as [storage.provider, PathLike, storage.callback]
        args.unshift(fs.readdir.bind(fs))
        callback = args.splice(-1, 1)[0] as storage.callback
        args.push((err: storage.err, files: storage.result) => {
          (callback as storage.callback)(err, files && files.map((file: PathLike) => typeof file === 'string' && file.normalize ? file.normalize('NFC') : file))
        })
        return storage.provide(...args)
      }
    }
    if (fs.readdirSync) {
      propertys.readdirSync = (path: PathLike) => {
        const files = storage.provideSync(path, fs.readdirSync.bind(fs))
        return files && files.map((file: PathLike) => typeof file === 'string' && file.normalize ? file.normalize('NFC') : file)
      }
    }
  }
  // 缓存模块
  if (Array.isArray(cacheMethodArray) && cacheMethodArray.length) {
    cacheMethodArray.filter((method) => (fs[method] || method === 'readJson')).forEach((method) => {
      const storage = new Storage(duration)
      storages.add(storage)
      // 异步的文件操作方法
      const fMethod = (method === 'readJson' && !fs[method]) ? (path: PathLike, callback: storage.callback) => {
        fs.readFile(path, (err: storage.err, buffer: storage.result | Buffer) => {
          if (err) return callback(err)
          let data
          try {
            data = JSON.parse(buffer.toString("utf-8"))
          } catch (e) {
            return callback(e)
          }
          callback(null, data)
        })
      } : fs[method].bind(fs)
      // 同步的文件操作方法
      const fMethodSync = (method === 'readJson' && !fs[`${method}Sync`]) ? (path: PathLike) => JSON.parse(fs.readFileSync(path).toString('utf-8')) : fs[`${method}Sync`].bind(fs)
      // 修改属性
      propertys[method] = function cacheMethod(path: PathLike, options: object | storage.callback, callback: storage.callback) {
        const args = Array.prototype.slice.call(arguments) as [storage.provider, PathLike, storage.callback]
        args.unshift(fMethod)
        return storage.provide(...args)
      }
      // 同步
      propertys[`${method}Sync`] = (path: PathLike) => storage.provideSync(path, fMethodSync)
    })
  }
  // 操作了具体文件，就把第1[index:0]个参数作为path 自动刷新
  if (Array.isArray(upathMethodArray) && upathMethodArray.length) {
    upathMethodArray.filter((method) => fs[method]).forEach((method) => {
      if (fs[method]) {
        // 提供一个新的方法来代替原来的这个异步方法
        propertys[method] = (...args: any[]) => fs[method](...argsCallbackAddHook(args, () => purge(typeof args[0] === 'string' ? args[0] : void 0)))
      }
      if (fs[`${method}Sync`]) {
        // 提供一个新的方法来代替原来的这个同步方法
        propertys[`${method}Sync`] = (...args: any[]) => {
          // 执行得到结果
          const res = fs[`${method}Sync`](...args)
          // 清除缓存
          purge(typeof args[0] === 'string' ? args[0] : void 0)
          // 返回结果
          return res
        }
      }
    })
  }
  // 因为操作了文件目录，所以缓存全盘清理
  if (Array.isArray(purgeMethodArray) && purgeMethodArray.length) {
    purgeMethodArray.filter((method) => fs[method]).forEach((method) => {
      if (fs[method]) {
        // 提供一个新的方法来代替原来的这个异步方法
        propertys[method] = (...args: any[]) => fs[method](...argsCallbackAddHook(args, () => purge()))
      }
      if (fs[`${method}Sync`]) {
        // 提供一个新的方法来代替原来的这个同步方法
        propertys[`${method}Sync`] = (...args: any[]) => {
          // 执行得到结果
          const res = fs[`${method}Sync`](...args)
          // 清除缓存
          purge()
          // 返回结果
          return res
        }
      }
    })
  }
  /**
   * 清理文件
   * @param {*} what
   */
  function purge(what?: string | string[]): void {
    if (typeof storages === 'object' && storages instanceof Set) {
      storages.forEach((storage) => storage.purge(what))
    }
  }
  /**
   * 在参数中找到回调，并且添加钩子
   * @param {*} args
   * @param {*} hook
   */
  function argsCallbackAddHook(args: any[], hook?: () => void) {
    let isHasCallback = false
    // 循环所有参数，试图寻找回调
    for (let index = args.length - 1; index >= 0; index--) {
      // 倒过来获取一个回调方法
      if (typeof args[index] === 'function') {
        isHasCallback = true
        // 得到回调方法，并且替换回调方法
        const callback = args[index]
        // 修改本原来回调方法
        args[index] = (...args: any[]) => {
          // 调用钩子
          if (hook) {
            hook()
          }
          // 回调原来的回调
          callback(...args)
        }
        break
      }
    }
    if (!isHasCallback) {
      args.push(() => hook && hook())
    }
    return args
  }
  return propertys as propertys
}
export default cachedFileSystem
