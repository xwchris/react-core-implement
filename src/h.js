import { TEXT_NODE } from './constants';

/**
 * 语法转换函数
 *
 * 相当于React中createElement函数
 * 使用@babel/plugin-transform-react-jsx来进行语法转换，该插件对js语法调用该函数
 */
export default function h(type, props, ...children) {
  props = props || {};

  // 空值和布尔值忽略不进行渲染
  // 数字和字符串都转成{type: TEXT_NODE}的形式便于统一处理
  children = [].concat(...children)
    .filter(child => child != null && typeof child !== 'boolean')
    .map(child => (typeof child === 'number' ? String(child) : child))
    .map(child => (typeof child === 'string' ? h(TEXT_NODE, { textContent: child }) : child));

  props.children = children;

  return { type, props };
}
