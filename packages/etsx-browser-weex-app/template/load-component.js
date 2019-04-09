import { loadFramework } from './common'
import { getDefault } from './config.js'
const importComponent = require.context('./components/', false, /\.js$/)
export const loadComponent = async (isWap, components) => {
  components = (Array.isArray(components) ? components : [components]).filter(Boolean)
  const res = {}

  return Promise.all(components.map((component) => Promise.all([
    loadFramework(isWap, component.toLowerCase() === 'head'),
    importComponent('./' + component.replace(/([A-Z])/g, '-$1').replace(/^(-{1})/, '').toLowerCase() + '.js')
  ])
    .then(([framework, res]) => getDefault(res)(framework))
    .then((c) => { res[component] = c }))).then(() => res)
}
export default loadComponent
