import path from 'path'
import { getOptions, defaultsDeepClone } from '@etsx/utils'
export type jsx = 'anujs' | 'nerv' | 'rax' | 'react' | string;
/**
 * 电脑版
 */
export type web = {
  /**
   * 根目录
   */
  root: string;
  /**
   * 资源
   */
  assets: string;
  /**
   * 模板
   */
  layouts: string;
  /**
   * 中间件
   */
  middleware: string;
  /**
   * 模板
   */
  views: string;
  /**
   * 每个页面的目录
   */
  pages: string;
  /**
   * 静态目录
   */
  static: string;
  /**
   * 状态管理
   */
  store: string;
  /**
   * 如果web端需要兼容ie 建议 使用 anujs 或 nerv
   */
  jsx: jsx
};
/**
 * 手机版
 */
export type wap = {
  /**
   * 根目录
   */
  root: string;
  /**
   * 资源
   */
  assets: string;
  /**
   * 模板
   */
  layouts: string;
  /**
   * 中间件
   */
  middleware: string;
  /**
   * 模板
   */
  views: string;
  /**
   * 每个页面的目录
   */
  pages: string;
  /**
   * 静态目录
   */
  static: string;
  /**
   * 状态管理
   */
  store: string;
  /**
   * 如果wap端需要打包app 建议 使用 rax
   */
  jsx: jsx
};

export function web(options: getOptions<web>, src: string): web {
  const web = defaultsDeepClone<web>(options, {
    root: path.resolve(src, 'web'),
    assets: 'assets',
    layouts: 'layouts',
    middleware: 'middleware',
    views: 'views',
    pages: 'pages',
    static: 'static',
    store: 'store',
    jsx: 'anujs',
  })
  web.assets = path.resolve(web.root, web.assets)
  web.layouts = path.resolve(web.root, web.layouts)
  web.middleware = path.resolve(web.root, web.middleware)
  web.views = path.resolve(web.root, web.views)
  web.pages = path.resolve(web.root, web.pages)
  web.static = path.resolve(web.root, web.static)
  web.store = path.resolve(web.root, web.store)
  return web
}

export function wap(options: getOptions<wap>, src: string): wap {
  const wap = defaultsDeepClone<wap>(options, {
    root: 'wap',
    assets: 'assets',
    layouts: 'layouts',
    middleware: 'middleware',
    views: 'views',
    pages: 'pages',
    static: 'static',
    store: 'store',
    jsx: 'rax',
  })
  wap.assets = path.resolve(wap.root, wap.assets)
  wap.layouts = path.resolve(wap.root, wap.layouts)
  wap.middleware = path.resolve(wap.root, wap.middleware)
  wap.views = path.resolve(wap.root, wap.views)
  wap.pages = path.resolve(wap.root, wap.pages)
  wap.static = path.resolve(wap.root, wap.static)
  wap.store = path.resolve(wap.root, wap.store)
  return wap
}
