import Framework from './base'
import { getDefault } from '../config'
export default class AnujsFramework extends Framework {
  static getFramework () {
    return import('anujs').then((f) => new AnujsFramework(getDefault(f)))
  }
}
