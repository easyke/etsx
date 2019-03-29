import Etsx from 'etsx'
import { BuildModule, buildEnv } from '@etsx/builder'

export class BuildContext extends BuildModule {
  public name: string;
  public isWeex: boolean;
  public isModern: boolean;
  public isServer: boolean;
  public constructor(etsx: Etsx, name: string) {
    super(etsx)
    this.name = name
    this.isWeex = this.name === 'weex'
    this.isServer = this.name === 'server'
    this.isModern = this.name === 'modern'
  }
  public get env(): { [key: string]: string | undefined } {
    const etsxEnv = this.etsxEnv
    const env: this['options']['env'] = {
      'process.env.NODE_ENV': JSON.stringify(etsxEnv.isDev ? 'development' : 'production'),
      'process.etsxis.debug': JSON.stringify(etsxEnv.isDebug),
      'process.etsxis.server': JSON.stringify(etsxEnv.isServer),
      'process.etsxis.client': JSON.stringify(etsxEnv.isClient),
      'process.etsxis.modern': JSON.stringify(etsxEnv.isModern),
      'process.etsxis.weex': JSON.stringify(etsxEnv.isWeex),
      'process.etsxis.browser': JSON.stringify(etsxEnv.isClient || etsxEnv.isModern),
    }
    Object.entries(this.options.env).forEach(([key, value]) => {
      env['process.env.' + key] = ['boolean', 'number'].includes(typeof value)
          ? value
          : JSON.stringify(value)
    })
    return env
  }
  public get etsxEnv(): buildEnv {
    return {
      isDev: this.options.dev,
      isDebug: !!this.options.debug,
      isServer: this.isServer,
      isClient: !this.isServer,
      isModern: !!this.isModern,
      isWeex: !!this.isWeex,
    }
  }
  public get color(): string {
    const colors: {
      [x: string]: string;
    } = {
      client: 'green',
      server: 'yellow',
      modern: 'blue',
      weex: 'cyan',
    }
    return this.name && colors[this.name] || 'yellow'
  }
}
export default BuildContext
