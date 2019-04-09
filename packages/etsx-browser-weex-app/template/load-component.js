import { loadFramework } from './common'
import { getDefault } from './config.js'
const importComponent = require.context('./components/', false, /\.js$/)
export const loadComponent = async (context, components) => {
  components = (Array.isArray(components) ? components : [components]).filter(Boolean)
  const promiseLikes = []
  const res = {}
  if (components.includes('Head')) {
    promiseLikes.push(
      Promise.all([
        loadFramework(context, true),
        importComponent('./head.js')
      ])
        .then(([{ createElement, Component }, res]) => getDefault(res)({ createElement, Component }))
        .then((Head) => { res.Head = Head })
    )
  }
  components.forEach((component) => {
    const name = './' + component.replace(/([A-Z])/g, '-$1').replace(/^(-{1})/, '').toLowerCase() + '.js'
    Promise.all([
      loadFramework(context, true),
      importComponent(name)
    ])
      .then(([{ createElement, Component }, res]) => getDefault(res)({ createElement, Component }))
      .then((c) => { res[component] = c })
  })
  return Promise.all(promiseLikes).then(() => res)
}
export default loadComponent
