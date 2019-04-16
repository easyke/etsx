import Etsx, { EtsxModule, EtsxOptions } from 'etsx';
import BuildOptions, { buildOptions } from './options';

export class BuildModule extends EtsxModule {
  constructor(etsx: Etsx) {
    super(etsx);
  }
  /**
   * 编译总配置
   */
  get buildOptions(): BuildOptions {
    type o = EtsxOptions & { build: buildOptions };
    if (!(this.options as o).build && (this.options.$options as o).build) {
      (this.options as o).build = new BuildOptions((this.options.$options as o).build)
    }
    if (!(this.options as o).build) {
      throw new Error('Uncaught TypeError: Cannot read property \'build\' of undefined');
    }
    return (this.options as o).build as BuildOptions
  }
  /**
   * weex 配置
   */
  get weexOptions() {
    return this.buildOptions.weex
  }
  /**
   * 浏览器配置
   */
  get browserOptions() {
    return this.buildOptions.browser
  }
  /**
   * 是否启用浏览器
   */
  get isEnableBrowser(): boolean {
    return this.browserOptions.enable === true
  }
  /**
   * 是否启用weex
   */
  get isEnableWeex(): boolean {
    return this.weexOptions.enable === true
  }
  /**
   * 本地文件系统
   */
  get lfs() {
    return this.localFileSystem
  }
  /**
   * 临时用的内存文件系统
   */
  get mfs() {
    return this.memoryFileSystem
  }
  /**
   * 文件 监听系统
   */
  get chokidarWatch() {
    return this.buildOptions.chokidarWatch
  }
  /**
   * 本地文件系统
   */
  get localFileSystem() {
    return this.buildOptions.localFileSystem
  }
  /**
   * 临时用的内存文件系统
   */
  get memoryFileSystem() {
    return this.buildOptions.memoryFileSystem
  }
}
export default BuildModule
