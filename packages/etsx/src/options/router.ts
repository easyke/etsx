
import { getOptions } from '@etsx/utils'

export class Router {
  /**
   * 路由
   */
  base: string;
  /**
   * 构造函数
   * @param options 配置选项
   */
  constructor(options?: getOptions<Router>) {
    if (!options) {
      options = {}
    }
    this.base = options.base || '/'
  }
}
export default Router
