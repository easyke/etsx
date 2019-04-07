export default class Framework {
  constructor (f) {
    this.framework = f
    this.createElement = f.createElement
    this.Component = f.Component
  }
  renderToDom (App, props, dom) {
    return Promise.resolve()
      .then(() => this.render(this.createElement(App, props), dom))
  }
}
