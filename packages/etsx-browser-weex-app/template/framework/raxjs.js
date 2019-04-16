import Framework from './base'
import { getDefault } from '../config'
export default class RaxjsFramework extends Framework {
  static getFramework () {
    return Promise.all([import('rax'), import('driver-dom')]).then(([f, driver]) => new RaxjsFramework(getDefault(f), getDefault(driver)))
  }
  constructor (framework, driver) {
    super(framework)
    this.driver = driver
  }
  renderToDom (App, props, dom) {
    return Promise.resolve()
      .then(() => this.render(this.createElement(App, props), dom, { driver: this.driver }))
  }
}
