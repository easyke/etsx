
import { getOptions, defaultsDeepClone } from '@etsx/utils'
import serveStatic from 'serve-static';

type servePlaceholderOptions = {
  skipUnknown?: boolean,
  statusCode?: number | string,
  placeholders?: string | Buffer | false,
  mimes?: any,
  noCache?: any,
  handlers: {
    [key: string]: false | undefined | string,
  },
};
export class Render {
  /**
   * 路由
   */
  fallback?: {
    dist: serveStatic.ServeStaticOptions,
    static: servePlaceholderOptions,
  };
  /**
   * 静态目录
   */
  static: serveStatic.ServeStaticOptions;
  /**
   * publicPath 在 非开发模式&非cdn加速 的渲染配置
   * .etsx/dist/client目录的内容
   */
  dist: serveStatic.ServeStaticOptions;
  staticPrefix: boolean;
  compressor: {};
  /**
   * 构造函数
   * @param options 配置选项
   */
  constructor(options?: getOptions<Render>) {
    if (!options) {
      options = {}
    }
    this.staticPrefix = typeof options.staticPrefix !== 'undefined' ? options.staticPrefix : true
    this.dist = options.dist || {}
    this.static = options.static || {}
    this.compressor = options.compressor || { threshold: 0 }
    this.fallback = {
      dist: {},
      static: defaultsDeepClone<servePlaceholderOptions>((options.fallback && options.fallback.static) || {}, {
        skipUnknown: true,
        handlers: {
          '.htm': false,
          '.html': false,
        },
      }),
    }
  }
}
export default Render
