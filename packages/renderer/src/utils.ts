import { TemplateExecutor } from 'lodash';
import template from 'lodash/template';

const templateOptions = {
  interpolate: /{{([\s\S]+?)}}/g,
}
export const parseTemplate = (templateStr: string): TemplateExecutor => template(templateStr, templateOptions)
