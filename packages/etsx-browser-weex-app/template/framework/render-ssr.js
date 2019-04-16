let anujs
let raxjs
let anujsReactDOMServer
let raxjsServerRenderer
export default {
  anujs: () => {
    if (!anujs) {
      anujs = require('anujs')
    }
    if (!anujsReactDOMServer) {
      anujsReactDOMServer = require('anujs/dist/React/server')
    }
    return (App, props) => anujsReactDOMServer.renderToString(anujs.createElement(App, props))
  },
  raxjs: () => {
    if (!raxjs) {
      raxjs = require('rax')
    }
    if (!raxjsServerRenderer) {
      raxjsServerRenderer = require('rax-server-renderer')
    }
    return (App, props) => raxjsServerRenderer.renderToString(raxjs.createElement(App, props))
  }
}
