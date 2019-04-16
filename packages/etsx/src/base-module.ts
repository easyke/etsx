import Etsx from './';
import { EtsxOptions } from './options';

export const etsx = Symbol('etsx')
export class EtsxModule {
  [etsx]: Etsx;
  constructor(ietsx: Etsx) {
    // 存储上下文
    this[etsx] = ietsx
  }
  get etsx(): Etsx {
    if (this[etsx]) {
      return this[etsx]
    } else {
      throw new Error('etsx error')
    }
  }
  get options(): EtsxOptions {
    if (this.etsx && this.etsx.options) {
      return this.etsx.options
    } else {
      throw new Error('etsx.options error')
    }
  }
}
export default EtsxModule
