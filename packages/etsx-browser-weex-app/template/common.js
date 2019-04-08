import { wapf, webf, headf, getDefault } from './config.js'
import modules from './framework'
export const loadFramework = (context, isHead) => Promise.resolve(isHead === true ? (headf || (context.isWap ? wapf : webf)) : (context.isWap ? wapf : webf))
  .then((m) => typeof modules[m] === 'function' ? modules[m]() : Promise.reject(new Error('框架不存在')))
  .then((f) => getDefault(f))
  .then((res) => res.getFramework(context))
