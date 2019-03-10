/**
 * diff简单实现
 *
 * 参考和修改于 https://reactjs.org/docs/implementation-notes.html 更多详细解释请阅读该文章
 */

import { RENDERED_INTERNAL_INSTANCE, INTERNAL_INSTANCE, OPERATION } from '../constants';
import {
  createNode, appendNode, replaceNode, removeNode,
  getParentNode, getFirstChildNode, updateNodeAttributes,
} from '../render/dom';

// 处理element节点
function instantiateComponent(element) {
  const { type } = element;
  const isHostComponent = typeof type === 'string';
  let internalInstance;

  // 这里使用两种对象进行处理而不是直接使用函数，是为了能够存储中间值
  // internalInstance就是这两种操作对象的实例(我们后面称这种实例为操作实例)，为了区别于组件实例publicInstance如此命名
  if (isHostComponent) {
    internalInstance = new HostComponent(element);
  } else {
    internalInstance = new CompositeComponent(element);
  }

  return internalInstance;
}

// 组件操作类
class CompositeComponent {
  constructor(element) {
    // 渲染的当前element节点
    this.currentElement = element;
    // 渲染组件的实例对象
    this.publicInstance = null;
    // class组件的render函数或函数组件的函数返回节点的渲染实例
    this.renderedInternalInstance = null;
  }

  // 获取该组件的容器dom节点
  getHostNode() {
    return this.renderedInternalInstance.getHostNode();
  }

  // 加载element
  mount() {
    const element = this.currentElement;
    const { type = (() => {}), props = {} } = element;

    // class组件和函数组件分开处理
    let renderedElement;
    if (isClass(type)) {
      const publicInstance = new type(props);
      this.publicInstance = publicInstance;
      renderedElement = publicInstance.render();
    } else {
      renderedElement = type(props);
    }

    // 获取操作实例
    const renderedInternalInstance = instantiateComponent(renderedElement);

    // 存储各值
    this.renderedInternalInstance = renderedInternalInstance;

    if (this.publicInstance) {
      this.publicInstance[RENDERED_INTERNAL_INSTANCE] = renderedInternalInstance;
    }

    // 加载该组件
    const node = renderedInternalInstance.mount();

    // 执行componentDidMount函数
    if (this.publicInstance && typeof this.publicInstance.componentDidMount === 'function') {
      this.publicInstance.componentDidMount();
    }

    return node;
  }

  // 卸载element
  unmount() {
    const { renderedInternalInstance } = this;
    renderedInternalInstance.unmount();
  }

  // 更新element
  receive(element) {
    // 需要使用到的变量
    const prevRenderedInternalInstance = this.renderedInternalInstance;
    const prevRenderedElement = prevRenderedInternalInstance.currentElement;

    const { type } = element;
    const nextProps = element.props || {};

    const { publicInstance } = this;
    publicInstance.props = nextProps;

    let nextRenderedElement;

    // 获取新的渲染element
    if (isClass(type)) {
      nextRenderedElement = publicInstance.render();
    } else {
      nextRenderedElement = type(nextProps);
    }

    // 如果类型相同则调用操作实例的receive函数
    if (prevRenderedElement.type === nextRenderedElement.type) {
      prevRenderedInternalInstance.receive(nextRenderedElement);
      return;
    }

    // 否则就进行替换操作
    const prevNode = prevRenderedInternalInstance.getHostNode();

    const nextRenderedInternalInstance = instantiateComponent(nextRenderedElement);
    const nextNode = nextRenderedInternalInstance.getHostNode();

    const parentNode = getParentNode(prevNode);
    if (parentNode) {
      replaceNode(parentNode, nextNode, prevNode);
    }
  }
}

// dom节点操作类
class HostComponent {
  constructor(element) {
    // 渲染的当前element节点
    this.currentElement = element;
    // 孩子element的操作实例列表
    this.renderedInternalInstanceChildren = [];
    // 对应的dom节点
    this.node = null;
  }

  // 获取对应dom节点
  getHostNode() {
    return this.node;
  }

  // 加载element
  mount() {
    const element = this.currentElement;

    const { props = {} } = element;

    // 创建界定啊
    const node = createNode(element);

    this.node = node;

    // 获取孩子element
    let elementChildren = props.children || [];
    if (!Array.isArray(elementChildren)) {
      elementChildren = [elementChildren];
    }

    // 获取孩子element操作实例
    const renderedInternalInstanceChildren = elementChildren.map(instantiateComponent);
    // 获取孩子dom
    const nodeChildren = renderedInternalInstanceChildren.map(child => child.mount());

    // 存储孩子element操作实例
    this.renderedInternalInstanceChildren = renderedInternalInstanceChildren;

    // 挂载dom节点
    nodeChildren.forEach(nodeChild => appendNode(node, nodeChild));

    return node;
  }

  // 卸载element
  unmount() {
    const { renderedInternalInstanceChildren } = this;
    const { node } = this;

    // 移除各个dom节点
    if (renderedInternalInstanceChildren) {
      renderedInternalInstanceChildren.forEach((child) => {
        child.unmount();
        const childNode = child.getHostNode();

        removeNode(node, childNode);
      });
    }
  }

  // 更新element
  receive(element) {
    const prevProps = this.currentElement.props;
    const nextProps = element.props || {};
    const { node } = this;

    // 更新dom属性
    updateNodeAttributes(node, nextProps, prevProps);

    const prevRenderedInternalInstanceChildren = this.renderedInternalInstanceChildren;
    const nextRenderedInternalInstanceChildren = [];

    const prevElementChildren = prevProps.children || [];
    const nextElementChildren = nextProps.children || [];

    const operationQueue = [];

    // 对比新孩子节点与旧孩子节点并进行操作
    for (let i = 0; i < nextElementChildren.length; i++) {
      const prevRenderedInternalInstance = prevRenderedInternalInstanceChildren[i];
      const prevElement = prevElementChildren[i];

      const nextElement = nextElementChildren[i];

      // 之前节点不存在则要创建新的的节点
      if (!prevElement) {
        const nextRenderedInternalInstance = instantiateComponent(nextElement);
        const nextNode = nextRenderedInternalInstance.getHostNode();

        nextRenderedInternalInstanceChildren.push(nextRenderedInternalInstance);

        operationQueue.push({ type: OPERATION.ADD, node: nextNode });
        continue;
      }

      const canUpdate = prevElement.type === nextElement.type;

      // 之前节点与当前节点类型不相同则进行替换
      if (!canUpdate) {
        const nextRenderedInternalInstance = instantiateComponent(nextElement);
        const nextNode = nextRenderedInternalInstance.getHostNode();

        const prevNode = prevRenderedInternalInstance.getHostNode();

        nextRenderedInternalInstanceChildren.push(nextRenderedInternalInstance);

        operationQueue.push({ type: OPERATION.REPLACE, prevNode, nextNode });
        continue;
      }

      // 前节点与当前节点类型相同则直接进行更新
      prevRenderedInternalInstance.receive(nextElement);
      nextRenderedInternalInstanceChildren.push(prevRenderedInternalInstance);
    }

    // 之前多余的孩子节点进行移除
    for (let j = nextElementChildren.length; j < prevElementChildren.length; j++) {
      const prevRenderedInternalInstance = prevRenderedInternalInstanceChildren[j];
      prevRenderedInternalInstance.unmount();

      const prevNode = prevRenderedInternalInstance.getHostNode();
      operationQueue.push({ type: OPERATION.REMOVE, node: prevNode });
    }

    // 执行各操作
    while (operationQueue.length > 0) {
      const operation = operationQueue.shift();

      if (operation.type === OPERATION.ADD) {
        appendNode(node, operation.node);
      } else if (operation.type === OPERATION.REMOVE) {
        removeNode(node, operation.node);
      } else if (operation.type === OPERATION.REPLACE) {
        replaceNode(node, operation.nextNode, operation.prevNode);
      }
    }
  }
}

// 卸载整根树
function unmountAll(containerNode) {
  const firstChildNode = getFirstChildNode(containerNode);

  if (firstChildNode) {
    const rootInternalInstance = firstChildNode[INTERNAL_INSTANCE];

    if (rootInternalInstance) {
      rootInternalInstance.unmount();
      const rootNode = rootInternalInstance.getHostNode();

      removeNode(containerNode, rootNode);
    }
  }
}

// 更新函数
function render(element, containerNode) {
  const firstChildNode = getFirstChildNode(containerNode);

  // 如果之前存在节点则查看能够直接进行更新
  if (firstChildNode) {
    const prevInternalInstance = firstChildNode[INTERNAL_INSTANCE];

    if (prevInternalInstance) {
      const prevElement = prevInternalInstance.currentElement;

      if (prevElement.type === element.type) {
        prevInternalInstance.receive(element);
        return;
      }
    }

    // 否则直接卸载这些节点
    unmountAll(containerNode);
  }

  // 获取操作实例
  const internalInstance = instantiateComponent(element);

  // 进行节点加载
  const node = internalInstance.mount();

  node[INTERNAL_INSTANCE] = internalInstance;

  // 挂载节点到根节点
  appendNode(containerNode, node);
}

// 类组件判断函数
function isClass(type) {
  if (type.isReactComponent) {
    return true;
  }
  return false;
}

// 类组件
function Component(props) {
  this.props = props;
}

// 类组件标识与纯函数组件进行区分
Component.isReactComponent = true;

Component.prototype = Object.assign({}, Component.prototype, {
  // setState函数
  setState: function setState(state) {
    const nextState = Object.assign({}, state);
    // 通过实例获取操作类
    const renderedInternalInstance = this[RENDERED_INTERNAL_INSTANCE];

    this.state = nextState;

    // 获取新的渲染element
    const nextRenderedElement = this.render();

    // 进行更新操作
    if (renderedInternalInstance) {
      renderedInternalInstance.receive(nextRenderedElement);
    }
  },
});

export { render, Component };
