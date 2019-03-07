import { TEXT_NODE } from '../constants';

export function createNode(element) {
  const type = element.type || '';
  const props = element.props || {};

  let node;

  if (typeof type !== 'string' || typeof props !== 'object') {
    return null;
  }

  if (type === TEXT_NODE) {
    node = document.createTextNode(props.textContent || '');
  } else {
    node = document.createElement(type);

    // 为节点赋值
    setNodeAttributes(node, props);
  }

  return node;
}

export function appendNode(parentNode, childNode) {
  if (!(parentNode instanceof Node) || !(childNode instanceof Node)) {
    return null;
  }

  parentNode.appendChild(childNode);
  return parentNode;
}

export function removeNode(parentNode, childNode) {
  if (!(parentNode instanceof Node) || !(childNode instanceof Node)) {
    return null;
  }

  parentNode.removeChild(childNode);
  return parentNode;
}

export function replaceNode(parentNode, newNode, oldNode) {
  if (!(parentNode instanceof Node) || !(newNode instanceof Node) || !(oldNode instanceof Node)) {
    return null;
  }

  parentNode.replaceChild(newNode, oldNode);
  return parentNode;
}

export function getParentNode(node) {
  if (!(node instanceof Node)) {
    return null;
  }

  return node.parentNode;
}

export function getFirstChildNode(node) {
  if (!(node instanceof Node)) {
    return null;
  }

  return node.firstChild;
}

const attributeHandler = {
  // 处理事件
  listener: (node, eventName, eventFunc) => {
    node.addEventListener(eventName, eventFunc);
  },

  unlistener: (node, eventName, eventFunc) => {
    node.removeEventListener(eventName, eventFunc);
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

const isListener = propName => propName.startsWith('on');
const isStyle = propName => propName === 'style';
const isClass = propName => propName === 'class' || propName === 'className';
const isChildren = propName => propName === 'children';

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

  Object.keys(oldProps)
    .filter(propName => !isChildren(propName) && propName in newProps)
    .forEach((propName) => { willRemoveProps[propName] = oldProps[propName]; });

  removeNodeAttributes(node, willRemoveProps);


  Object.keys(newProps)
    .filter(propName => !isChildren(propName))
    .forEach((propName) => { willSetProps[propName] = newProps[propName]; });

  setNodeAttributes(node, willSetProps);
}

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
      attributeHandler.unlistener(node, propName.replace(/^on/, '').toLowerCase(), value);
    } else if (!isChildren(propName)) {
      node.removeAttribute(propName, value);
    }
  });
}
