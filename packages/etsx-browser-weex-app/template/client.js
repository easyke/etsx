import { loadComponent } from './components/document'
import { loadFramework } from './common'

export const createApp = async (context) => {
  const etsx = {}
  const [{ Head, Main }, headFramework, mainFramework] = await Promise.all([
    loadComponent(context),
    loadFramework(context, true),
    loadFramework(context, false)
  ])

  etsx.headApp = await headFramework.renderToDom(Head, {}, document.head)
  etsx.mainApp = await mainFramework.renderToDom(Main, {}, document.getElementById('__etsx'))

  if (typeof window !== 'undefined' && window.window === window) {
    window.$etsx = etsx
  }
  return etsx
}
createApp({ isWap: false })
