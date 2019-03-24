import path from 'path'
import { getOptions, defaultsDeepClone } from '@etsx/utils'
export type jsx = 'anujs' | 'nerv' | 'rax' | 'react' | string;
/**
 * 微信小程序
 */
export type wechat = {
  /**
   * 根目录
   */
  root: string;
  /**
   * 资源
   */
  assets: string;
  /**
   * 每个页面的目录
   */
  pages: string;
  /**
   * 静态目录
   */
  static: string;
};
/**
 * 支付宝小程序
 */
export type alipay = {
  /**
   * 根目录
   */
  root: string;
  /**
   * 资源
   */
  assets: string;
  /**
   * 每个页面的目录
   */
  pages: string;
  /**
   * 静态目录
   */
  static: string;
};
/**
 * 百度小程序
 */
export type baidu = {
  /**
   * 根目录
   */
  root: string;
  /**
   * 资源
   */
  assets: string;
  /**
   * 每个页面的目录
   */
  pages: string;
  /**
   * 静态目录
   */
  static: string;
};
export type miniProgram = {
  /**
   * 微信小程序
   */
  wechat: wechat,
  /**
   * 支付宝小程序
   */
  alipay: alipay,
  /**
   * 百度小程序
   */
  baidu: baidu,
};

export function miniProgram(options: getOptions<miniProgram>, src: string): miniProgram {
  return {
    wechat: wechat(options.wechat || {}, path.resolve(src, 'miniProgram')),
    alipay: alipay(options.alipay || {}, path.resolve(src, 'miniProgram')),
    baidu: baidu(options.baidu || {}, path.resolve(src, 'miniProgram')),
  }
}

export function wechat(options: getOptions<wechat>, src: string): wechat {
  const wechat = defaultsDeepClone<wechat>(options, {
    root: path.resolve(src, 'wechat'),
    assets: 'assets',
    pages: 'pages',
    static: 'static',
  })
  wechat.assets = path.resolve(wechat.root, wechat.assets)
  wechat.pages = path.resolve(wechat.root, wechat.pages)
  wechat.static = path.resolve(wechat.root, wechat.static)
  return wechat
}
export function alipay(options: getOptions<alipay>, src: string): alipay {
  const alipay = defaultsDeepClone<alipay>(options, {
    root: path.resolve(src, 'alipay'),
    assets: 'assets',
    pages: 'pages',
    static: 'static',
  })
  alipay.assets = path.resolve(alipay.root, alipay.assets)
  alipay.pages = path.resolve(alipay.root, alipay.pages)
  alipay.static = path.resolve(alipay.root, alipay.static)
  return alipay
}
export function baidu(options: getOptions<baidu>, src: string): baidu {
  const baidu = defaultsDeepClone<baidu>(options, {
    root: path.resolve(src, 'baidu'),
    assets: 'assets',
    pages: 'pages',
    static: 'static',
  })
  baidu.assets = path.resolve(baidu.root, baidu.assets)
  baidu.pages = path.resolve(baidu.root, baidu.pages)
  baidu.static = path.resolve(baidu.root, baidu.static)
  return baidu
}
