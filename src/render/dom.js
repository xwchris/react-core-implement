/**
 * 浏览器渲染器
 *
 * 用于dom渲染的各种操作
 */

import { TEXT_NODE } from '../constants';

// 创建dom节点函数
export function createNode(element) {
  const type = element.type || '';
  const props = element.props || {};

  let node;

  if (typeof type !== 'string' || typeof props !== 'object') {
    return null;
  }

  // Text节点使用createTextNode函数进行创建
  // 其他HTMLElement节点使用creatElement节点进行创建
  if (type === TEXT_NODE) {
    node = document.createTextNode(props.textContent || '');
  } else {
    node = document.createElement(type);

    // 为节点赋值
    setNodeAttributes(node, props);
  }

  return node;
}

// 追加dom节点函数
export function appendNode(parentNode, childNode) {
  if (!(parentNode instanceof Node) || !(childNode instanceof Node)) {
    return null;
  }

  parentNode.appendChild(childNode);
  return parentNode;
}

// 移除dom节点函数
export function removeNode(parentNode, childNode) {
  if (!(parentNode instanceof Node) || !(childNode instanceof Node)) {
    return null;
  }

  parentNode.removeChild(childNode);
  return parentNode;
}

// 替代dom节点函数
export function replaceNode(parentNode, newNode, oldNode) {
  if (!(parentNode instanceof Node) || !(newNode instanceof Node) || !(oldNode instanceof Node)) {
    return null;
  }

  parentNode.replaceChild(newNode, oldNode);
  return parentNode;
}

// 获取dom节点父节点
export function getParentNode(node) {
  if (!(node instanceof Node)) {
    return null;
  }

  return node.parentNode;
}

// 获取第一个孩子dom节点
export function getFirstChildNode(node) {
  if (!(node instanceof Node)) {
    return null;
  }

  return node.firstChild;
}

// 事件代理 为了方便进行事件绑定和取消绑定
function eventProxy(e) {
  return this._listener[e.type](e);
}

// 属性处理器
const attributeHandler = {
  // 处理事件
  listener: (node, eventName, eventFunc) => {
    node.addEventListener(eventName, eventProxy);
    node._listener = node._listener || {};
    node._listener[eventName] = eventFunc;
  },

  unlistener: (node, eventName) => {
    node.removeEventListener(eventName, eventProxy);
  },

  // 处理样式属性
  style: (node, value) => {
    if (typeof value === 'object') {
      value = Object.keys(value).map(key => `${key}: ${value[key]}`).join(', ');
    }

    node.setAttribute('style', value);
  },

  // 处理class属性
  className: (node, value) => {
    node.setAttribute('class', value);
  },
};

// 各种属性判断函数
const isListener = propName => propName.startsWith('on');
const isStyle = propName => propName === 'style';
const isClass = propName => propName === 'class' || propName === 'className';
const isChildren = propName => propName === 'children';

// 设置节点属性
export function setNodeAttributes(node, props) {
  if (!(node instanceof HTMLElement)) {
    return;
  }

  props = props || {};

  if (typeof props !== 'object') {
    return;
  }

  Object.keys(props).forEach((propName) => {
    const value = props[propName];

    if (isListener(propName)) {
      attributeHandler.unlistener(node, propName.replace(/^on/, '').toLowerCase());
      attributeHandler.listener(node, propName.replace(/^on/, '').toLowerCase(), value);
    } else if (isStyle(propName)) {
      attributeHandler.style(node, value);
    } else if (isClass(propName)) {
      attributeHandler.className(node, value);
    } else if (!isChildren(propName)) {
      node.setAttribute(propName, value);
    }
  });
}

// 更新节点属性
export function updateNodeAttributes(node, newProps, oldProps) {
  newProps = newProps || {};
  oldProps = oldProps || {};

  if (node instanceof Text) {
    node.textContent = newProps.textContent || '';
    return;
  }

  if (!(node instanceof HTMLElement)) {
    return;
  }

  if (typeof newProps !== 'object' || typeof oldProps !== 'object') {
    return;
  }

  const willRemoveProps = {};
  const willSetProps = {};

  const hasProperty = (obj, propName) => !Object.prototype.hasOwnProperty.call(obj, propName);

  Object.keys(oldProps)
    .filter(propName => !isChildren(propName) && hasProperty(newProps, propName))
    .forEach((propName) => { willRemoveProps[propName] = oldProps[propName]; });

  removeNodeAttributes(node, willRemoveProps);

  Object.keys(newProps)
    .filter(propName => !isChildren(propName))
    .forEach((propName) => { willSetProps[propName] = newProps[propName]; });

  setNodeAttributes(node, willSetProps);
}

// 移除节点属性
export function removeNodeAttributes(node, props) {
  if (!(node instanceof HTMLElement)) {
    return;
  }

  props = props || {};

  if (typeof props !== 'object') {
    return;
  }

  Object.keys(props).forEach((propName) => {
    const value = props[propName];

    if (isListener(propName)) {
      attributeHandler.unlistener(node, propName.replace(/^on/, '').toLowerCase());
    } else if (!isChildren(propName)) {
      node.removeAttribute(propName, value);
    }
  });
}
