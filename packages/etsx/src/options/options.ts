import Dir from './dir'
import Router from './router'
import Render from './render'
import EtsxApp from './app'
import { isUrl, getOptions } from '@etsx/utils'

type EtsxOptionsNot$options = { [P in keyof EtsxOptions]: P extends '$options' ? undefined : EtsxOptions[P]};
export type options = getOptions<EtsxOptionsNot$options>
export class EtsxOptions extends EtsxApp {
  $options: options;
  /**
   * 目录
   */
  dir: Dir;
  /**
   * 路由
   */
  router: Router;
  /**
   * 渲染者
   */
  render: Render;
  /**
   * 监听重启
   */
  watch: string[];
  /**
   * 在生产发布模式[etsx build]下，为了使用CDN来获得最快渲染性能，
   * 将.etsx/dist/client目录的内容上传到您的CDN后，
   * 只需将publicPath设置为CDN即可。
   *
   * ** 浏览器的异步加载脚本通过 /_etsx/browser/*.js 访问
   * ** weex jsbundle 可以通过 /_etsx/weex/*.js ，用于调试，比如淘宝扫码
   *
   * 类型: String
   * 默认: '/_etsx/'
   */
  publicPath: string;
  /**
   * 如果publicPath不是cdn，_publicPath将是一个publicPath副本，
   * 否则，_publicPath用于调试开发
   *
   * 类型: String
   * 默认: publicPath | '/_etsx/'
   */
  _publicPath: string;
  constructor(options: options = {}) {
    super(options)
    // 原始配置项
    this.$options = options || {}
    // 监听重启
    this.watch = options.watch && Array.isArray(options.watch) ? options.watch : []
    // 目录 - Dirs and extensions
    this.dir = new Dir(this.$options.dir || {});
    // 路由配置
    this.router = new Router(this.$options.router || {});
    // 渲染
    this.render = new Render(this.$options.render || {});

    // cdn 分发
    this.publicPath = (typeof options.publicPath === 'string' ? options.publicPath : '') || '/_etsx/';
    // 调试使用
    this._publicPath = isUrl(this.publicPath) ? this.publicPath : '/_etsx/';

    // this.render = render.call(this, options);
    // this.messages = messages.call(this, options);

    // Apply default hash to CSP option
    /*const csp = this.render.csp
    const cspDefaults = {
      hashAlgorithm: 'sha256',
      allowedSources: void 0,
      policies: void 0,
      reportOnly: this.debug,
    }
    if (csp) {
      this.render.csp = defaults(isObject(csp) ? csp : {}, cspDefaults)
    }*/
  }
}
