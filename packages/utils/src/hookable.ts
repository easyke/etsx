import { logger } from './logger'
import { sequence } from './task'

const hooks = Symbol('hooks')

export type HookHandler = (...args: any[]) => any;
type configHooks = { [key: string]: HookHandler | HookHandler[] | configHooks };
/**
 * 基础的钩子类
 *
 * @class      Hookable (name)
 */
export class Hookable {
  [hooks]: Map<string, Set<HookHandler>>;
  constructor() {
    // 初始化钩子存储
    this[hooks] = new Map()
    // 绑定钩子的上下文
    this.hook = this.hook.bind(this)
    // 绑定调用钩子的上下文
    this.callHook = this.callHook.bind(this)
  }

  // 绑定钩子
  hook(name: string, fn: HookHandler) {
    // 必须传入名字和方法
    if (!name || typeof fn !== 'function') {
      return
    }
    const hooks = this.hooks.get(name) || new Set()
    // 强制是一个数组
    if (!hooks || !hooks.size) {
      this.hooks.set(name, hooks)
    }
    // 把名为name的fn插入hooks中
    hooks.add(fn)
  }

  /**
   * 调用钩子
   *
   * @param      {string}   name    The name
   * @param      {Array}    args    The arguments
   * @return     {Promise}  { description_of_the_return_value }
   */
  async callHook(name: string, ...args: any[]) {
    const hooks = this.hooks.get(name)
    if (!hooks || !(hooks instanceof Set)) {
      return
    }
    logger.debug(`Call ${name} hooks (${hooks.size})`)
    try {
      await sequence(Array.from(hooks), (fn: HookHandler) => fn(...args))
    } catch (err) {
      if (name !== 'error') {
        this.callHook('error', err)
      }
      logger.fatal(err)
    }
  }
  /**
   * 清理钩子
   *
   * @param      {<type>}  name    The name
   */
  clearHook(name: string | HookHandler, handler?: HookHandler): this {
    if (typeof name === 'string') {
      if (typeof handler === 'function') {
        const handlers = this.hooks.get(name)
        if (handlers) {
          handlers.delete(handler)
        }
      } else {
        this.hooks.delete(name)
      }
    } else if (typeof name === 'function') {
      this.hooks.forEach((handlers) => handlers.delete(name))
    } else {
      this.hooks.clear()
    }
    return this
  }
  /**
   * 把所有的钩子打平
   *
   * @param      {<type>}  configHooks  The configuration hooks
   * @param      {<type>}  hooks        The hooks
   * @param      {<type>}  parentName   The parent name
   */
  flatHooks(configHooks: configHooks, hooks: { [key: string]: HookHandler | HookHandler[] } = {}, parentName?: string): { [key: string]: HookHandler | HookHandler[] } {
    Object
      .keys(configHooks)
      .forEach((key: string) => {
        if (!configHooks[key]) {
          return;
        }
        // 取得名字
        const name = parentName ? `${parentName}:${key}` : key
        // 取得钩子
        const subHook = configHooks[key]
        if (typeof subHook === 'function' || Array.isArray(subHook)) {
          hooks[name] = subHook
        } else if (typeof subHook === 'object') {
          this.flatHooks(subHook, hooks, name)
        }
      })
    return hooks
  }
  /**
   * 添加钩子
   *
   * @param      {<type>}  configHooks  The configuration hooks
   */
  addHooks(configHooks: configHooks) {
    const hooks = this.flatHooks(configHooks)
    Object
      .keys(hooks)
      .filter(Boolean)
      .forEach((key: string) => {
        ([] as HookHandler[]).concat(hooks[key]).forEach((h) => this.hook(key, h));
      })
  }
  get hooks(): Map<string, Set<HookHandler>> {
    if (!this[hooks]) {
      this[hooks] = new Map()
    }
    return this[hooks]
  }
}
export default Hookable
