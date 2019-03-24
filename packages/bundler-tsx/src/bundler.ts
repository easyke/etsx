import { Builder, BuildModule } from '@etsx/builder'
export class Bundler extends BuildModule {
  builder: Builder;
  constructor(builder: Builder) {
    super(builder.etsx);
    this.builder = builder
  }
  async build() {

  }
}

export default Bundler
