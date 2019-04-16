import { wapf, webf, headf, getDefault } from './config.js'
import modules from './framework'
export const loadFramework = (isWap, isHead) => Promise.resolve(isHead === true ? (headf || (isWap ? wapf : webf)) : (isWap ? wapf : webf))
  .then((m) => typeof modules[m] === 'function' ? modules[m]() : Promise.reject(new Error('框架不存在')))
  .then((f) => getDefault(f))
  .then((res) => res.getFramework())
