import { headf, wapf, webf } from './config'
import { loadComponent } from './load-component'

export const createApp = async (context) => {
  const { Head, Main } = await loadComponent(context, ['Head', 'Main'])
  return { Head, Main, headFramework: headf, mainFramework: context.isWap ? wapf : webf }
}
export default createApp
