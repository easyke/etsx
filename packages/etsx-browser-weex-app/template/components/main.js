export default ({ createElement, Component, isWap }) => {
  return class Main extends Component {
    constructor (...args) {
      super(...args)
      this.state = { xxs: '-***0' }
    }
    render () {
      return createElement('div', {}, ['333', this.state.xxs])
    }
  }
}
