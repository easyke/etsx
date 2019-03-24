import Etsx from 'etsx'
import { IPackBundle } from './builder'
import BuildModule from './build-module'
export class PackBundle extends BuildModule implements IPackBundle {
  compilers: [] = []
  constructor(etsx: Etsx) {
    super(etsx);
    this.compilers = [];
  }
  async build() {

  };
  async unwatch() {

  };
}
export default PackBundle
