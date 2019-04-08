import { loadFramework } from '../common'

const runHead = ({ createElement, Component, isWap }) => {
  class Head extends Component {
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

  return Head
}
const runMain = ({ createElement, Component, isWap }) => {
  class Main extends Component {
    constructor (...args) {
      super(...args)
      this.state = { xxs: '-***0' }
    }
    render () {
      return createElement('div', {}, ['333', this.state.xxs])
    }
  }

  return Main
}
export const loadComponent = async (context) => {
  return Promise.all([
    loadFramework(context, true).then(({ createElement, Component }) => runHead({ createElement, Component, isWap: context.isWap })),
    loadFramework(context, false).then(({ createElement, Component }) => runMain({ createElement, Component, isWap: context.isWap }))
  ])
    .then(([Head, Main]) => ({ Head, Main }))
}
export default loadComponent
