import Framework from './base'
import { getDefault } from '../config'
export default class AnujsFramework extends Framework {
  static getFramework (context) {
    if (context && context.loadedAsync) {
      context.loadedAsync.add(module.id)
    }
    return import('anujs').then((f) => new AnujsFramework(getDefault(f)))
  }
}
