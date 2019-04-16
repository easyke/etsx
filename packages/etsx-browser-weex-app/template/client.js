import { loadComponent } from './load-component'
import { loadFramework } from './common'

export const createApp = async (context) => {
  const isWap = context.isWap
  const etsx = { loadComponent, loadFramework }
  const [{ Head, Main, Loadable }, headFramework, mainFramework] = await Promise.all([
    loadComponent(isWap, ['Head', 'Main', 'Loadable']),
    loadFramework(isWap, true),
    loadFramework(isWap, false)
  ])
  console.log(Loadable)
  etsx.headApp = await headFramework.renderToDom(Head, {}, document.head)
  etsx.mainApp = await mainFramework.renderToDom(Main, {}, document.getElementById('__etsx'))

  if (typeof window !== 'undefined' && window.window === window) {
    window.$etsx = etsx
  }
  return etsx
}
createApp({ isWap: false })
