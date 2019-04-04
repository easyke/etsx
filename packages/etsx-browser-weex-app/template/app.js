const { loadComponent } = require('./components/document')

export let wapBootApp = null
export let webBootApp = null

export const getApp = (isWap) => {
  console.log('------ begin: 4334 ------')
  loadComponent({ isWap })
    .then(({ Document, Head, Body }) => {
      // document.documentElement
      console.log('------ begin: 44 ------')
      console.log()
      console.log('------ end: Document, Head, Body  ------\n\n')
    })
}
