export default class Framework {
  constructor (f) {
    this.framework = f
    this.createElement = f.createElement
    this.Component = f.Component
    this.render = f.render
  }
  renderToDom (App, props, dom) {
    return Promise.resolve()
      .then(() => this.render(this.createElement(App, props), dom))
  }
}
