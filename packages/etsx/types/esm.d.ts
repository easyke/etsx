export = esm;
import Module from 'module';
type options = {
  cache?: boolean;
  sourceMap?: boolean;
  cjs?: boolean;
  await?: boolean;
  force?: boolean;
  wasm?: boolean;
  mainFields?: string[];
  mode?: 'auto' | 'all' | 'strict';
}
declare function esm(module: Module, options: options): NodeRequire;
