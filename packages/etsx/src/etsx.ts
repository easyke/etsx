
import { Hookable, logger } from '@etsx/utils'
import { application } from '@etsx/listener'
import Resolver from './resolver';
import { options, EtsxOptions, getDefaultEtsxConfig } from './options';
import isPlainObject from 'lodash/isPlainObject';
import Server from '@etsx/server'
import ModuleContainer from './module';

export const ready = Symbol('ready')
export const initialized = Symbol('initialized')
const version = '0.0.1'

export class Etsx extends Hookable {
  render: application.App;
  server: Server;
  renderer: Etsx['server'];
  resolver: Resolver;
  options: EtsxOptions;
  [ready]: Promise<Etsx>;
  [initialized]: boolean;
  moduleContainer: ModuleContainer;
  constructor(options: options = {}) {
    super()
    // 分配选项并应用默认值
    this.options = getDefaultEtsxConfig(options)

    // 创建核心组件的实例
    // 计算路径使用
    this.resolver = new Resolver(this)
    // 模块
    this.moduleContainer = new ModuleContainer(this)
    // 渲染者 - 实例化渲染服务
    this.renderer = this.server = new Server(this)
    // 渲染
    this.render = this.server.app

    // Wait for Etsx to be ready
    this[initialized] = false
    // 准备就绪
    this[ready] = this.ready()
    this[ready].catch((err) => {
      logger.fatal(err)
    })
  }
  /**
   * 获取版本号
   */
  static get version() {
    return version
  }
  /**
   * 准备就绪
   */
  async ready(): Promise<Etsx> {
    // 如果存在就直接返回
    if (this[ready]) {
      return this[ready]
    }

    // 添加钩子[配置项传入的钩子]
    if (typeof this.options.hooks === 'function') {
      // 既然配置项传入的钩子是一个方法，就直接调用他，并且给予它一个绑定钩子的方法
      this.options.hooks(this.hook)
    } else if (this.options.hooks && isPlainObject(this.options.hooks)) {
      // 直接添加
      this.addHooks(this.options.hooks)
    }

    // 等待模块 准备就绪
    await this.moduleContainer.ready()

    // 等待 服务器中间件模块 准备就绪
    await this.server.ready()

    // 标记已经初始化完成
    this[initialized] = true

    // 调用准备就绪接口
    await this.callHook('ready', this)
    // 返回本项目实例
    return this
  }
  get initialized() {
    return this[initialized] || false
  }
  /**
   * 关闭项目
   * @param {Function} callback
   */
  async close(callback?: (() => any)) {
    // 异步调用关闭钩子
    await this.callHook('close', this)

    /* istanbul ignore if */
    if (typeof callback === 'function') {
      await callback()
    }
  }
}
export default Etsx
