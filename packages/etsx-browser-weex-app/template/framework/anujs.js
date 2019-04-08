import Framework from './base'
import { getDefault } from '../config'
const modulesId = module.id
export default class AnujsFramework extends Framework {
  static getFramework (context) {
    if (context && context.loadedAsync) {
      context.loadedAsync.add(modulesId)
    }
    return import('anujs').then((f) => new AnujsFramework(getDefault(f)))
  }
}
