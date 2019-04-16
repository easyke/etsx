
export let getDefault = (mod) => (mod && mod.__esModule) ? mod['default'] : mod
export let raxjs = null
export let raxApp = null
export let anujs = null
export let anuApp = null
export let raxDriverDOM = null
export const moduleHotInit = () => {
  if (module.hot) {
    console.log(44434)
    // tslint:disable-next-line
    module.hot.accept('/Users/hua/Documents/Project/cdn/sic-ude/web/pages/index.tsx', function () {
      console.log(4444)
      // Do something with the updated library module...
    })
  }
}
export const renderAnujs = (App, dom) => {
  return getAunjs()
    .then((aunjs) => aunjs.render(aunjs.createElement(App, {}), dom))
    .then((app) => { anuApp = app })
}
export const renderRaxjs = (App, dom) => {
  return Promise.all([getRaxjs(), getRaxDriverDOM()])
    .then(([{ createElement, render }, driver]) => render(createElement(App, {}), dom, { driver }))
    .then((app) => { raxApp = app })
}
export const getRaxDriverDOM = () => {
  if (raxDriverDOM) {
    return Promise.resolve(raxDriverDOM)
  }
  return import('driver-dom').then((input) => {
    raxDriverDOM = getDefault(input)
    raxDriverDOM = null
    return raxDriverDOM
  })
}
export const getRaxjs = () => {
  if (raxjs) {
    return Promise.resolve(raxjs)
  }
  return import('rax').then((input) => {
    raxjs = getDefault(input)
    return raxjs
  })
}
export const getAunjs = () => {
  if (anujs) {
    return Promise.resolve(anujs)
  }
  return import('anujs').then((input) => {
    anujs = getDefault(input)
    return anujs
  })
}
