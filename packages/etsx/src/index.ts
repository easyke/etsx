/**
 * 必须优先导出 EtsxModule 模板
 */
export { EtsxModule } from './base-module';
export { options, EtsxOptions, getDefaultEtsxConfig } from './options';
export { Etsx, Etsx as default }  from './etsx';
export { Server } from '@etsx/server'
export { ModuleContainer } from './module';
import * as server from '@etsx/server'
import * as etsx from './etsx';
import * as moduleContainer from './module';
export {
  etsx,
  server,
  moduleContainer,
}
