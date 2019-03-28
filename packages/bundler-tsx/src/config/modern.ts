import Etsx from 'etsx';
import ClientWebpackConfig from './client'

export class ModernWebpackConfig extends ClientWebpackConfig {
  constructor(etsx: Etsx) {
    super(etsx, 'modern')
  }
}

export default ModernWebpackConfig
