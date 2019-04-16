export default ({ createElement, Component, isWap }) => {
  return class Head extends Component {
    constructor (...args) {
      super(...args)
      this.state = { xx: 2 }
    }
    render () {
      return createElement('head', {}, [
        createElement('title', {}, this.state.xx),
        createElement('meta', { 'http-equiv': 'cleartype', 'content': 'on', 'data-react-helmet': 'true' }),
        createElement('meta', { 'name': 'viewport' })
      ])
    }
  }
}
