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
