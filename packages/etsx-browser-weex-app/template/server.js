import { headf, wapf, webf } from './config'
import { loadComponent } from './load-component'

export const createApp = async (context) => {
  const isWap = context.isWap
  const { Head, Main } = await loadComponent(isWap, ['Head', 'Main'])
  return { Head, Main, headFramework: headf, mainFramework: isWap ? wapf : webf }
}
export default createApp
