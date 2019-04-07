import { headf, wapf, webf } from './config'
import { loadComponent } from './components/document'

export const createApp = async (context) => {
  const { Head, Main } = await loadComponent(context)
  return { Head, Main, headFramework: headf, mainFramework: context.isWap ? wapf : webf }
}
export default createApp
