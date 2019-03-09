import { RENDERED_INTERNAL_INSTANCE, INTERNAL_INSTANCE, OPERATION } from '../constants';
import {
  createNode, appendNode, replaceNode, removeNode,
  getParentNode, getFirstChildNode, updateNodeAttributes,
} from '../render/dom';

class CompositeComponent {
  constructor(element) {
    this.currentElement = element;
    this.publicInstance = null;
    this.renderedInternalInstance = null;
  }

  getHostNode() {
    return this.renderedInternalInstance.getHostNode();
  }

  mount() {
    const element = this.currentElement;
    const { type = (() => {}), props = {} } = element;

    let renderedElement;
    if (isClass(type)) {
      const publicInstance = new type(props);
      this.publicInstance = publicInstance;
      renderedElement = publicInstance.render();
    } else {
      renderedElement = type(props);
    }

    const renderedInternalInstance = instantiateComponent(renderedElement);

    this.renderedInternalInstance = renderedInternalInstance;

    if (this.publicInstance) {
      this.publicInstance[RENDERED_INTERNAL_INSTANCE] = renderedInternalInstance;
    }

    const node = renderedInternalInstance.mount();

    if (this.publicInstance && typeof this.publicInstance.componentDidMount === 'function') {
      this.publicInstance.componentDidMount();
    }

    return node;
  }

  unmount() {
    const { renderedInternalInstance } = this;
    renderedInternalInstance.unmount();
  }

  receive(element) {
    const prevRenderedInternalInstance = this.renderedInternalInstance;
    const prevRenderedElement = prevRenderedInternalInstance.currentElement;

    const { type } = element;
    const nextProps = element.props || {};

    const { publicInstance } = this;
    publicInstance.props = nextProps;

    let nextRenderedElement;

    if (isClass(type)) {
      nextRenderedElement = publicInstance.render();
    } else {
      nextRenderedElement = type(nextProps);
    }

    if (prevRenderedElement.type === nextRenderedElement.type) {
      prevRenderedInternalInstance.receive(nextRenderedElement);
      return;
    }

    const prevNode = prevRenderedInternalInstance.getHostNode();

    const nextRenderedInternalInstance = instantiateComponent(nextRenderedElement);
    const nextNode = nextRenderedInternalInstance.getHostNode();

    const parentNode = getParentNode(prevNode);
    if (parentNode) {
      replaceNode(parentNode, nextNode, prevNode);
    }
  }
}

class HostComponent {
  constructor(element) {
    this.currentElement = element;
    this.renderedInternalInstanceChildren = [];
    this.node = null;
  }

  getHostNode() {
    return this.node;
  }

  mount() {
    const element = this.currentElement;

    const { props = {} } = element;

    const node = createNode(element);

    this.node = node;

    let elementChildren = props.children || [];
    if (!Array.isArray(elementChildren)) {
      elementChildren = [elementChildren];
    }

    const renderedInternalInstanceChildren = elementChildren.map(instantiateComponent);
    const nodeChildren = renderedInternalInstanceChildren.map(child => child.mount());

    this.renderedInternalInstanceChildren = renderedInternalInstanceChildren;

    nodeChildren.forEach(nodeChild => appendNode(node, nodeChild));

    return node;
  }

  unmount() {
    const { renderedInternalInstanceChildren } = this;
    const { node } = this;

    if (renderedInternalInstanceChildren) {
      renderedInternalInstanceChildren.forEach((child) => {
        child.unmount();
        const childNode = child.getHostNode();

        removeNode(node, childNode);
      });
    }
  }

  receive(element) {
    const prevProps = this.currentElement.props;
    const nextProps = element.props || {};
    const { node } = this;

    updateNodeAttributes(node, nextProps, prevProps);

    const prevRenderedInternalInstanceChildren = this.renderedInternalInstanceChildren;
    const nextRenderedInternalInstanceChildren = [];

    const prevElementChildren = prevProps.children || [];
    const nextElementChildren = nextProps.children || [];

    const operationQueue = [];

    for (let i = 0; i < nextElementChildren.length; i++) {
      const prevRenderedInternalInstance = prevRenderedInternalInstanceChildren[i];
      const prevElement = prevElementChildren[i];

      const nextElement = nextElementChildren[i];

      if (!prevElement) {
        const nextRenderedInternalInstance = instantiateComponent(nextElement);
        const nextNode = nextRenderedInternalInstance.getHostNode();

        nextRenderedInternalInstanceChildren.push(nextRenderedInternalInstance);

        operationQueue.push({ type: OPERATION.ADD, node: nextNode });
        continue;
      }

      const canUpdate = prevElement.type === nextElement.type;

      if (!canUpdate) {
        const nextRenderedInternalInstance = instantiateComponent(nextElement);
        const nextNode = nextRenderedInternalInstance.getHostNode();

        const prevNode = prevRenderedInternalInstance.getHostNode();

        nextRenderedInternalInstanceChildren.push(nextRenderedInternalInstance);

        operationQueue.push({ type: OPERATION.REPLACE, prevNode, nextNode });
        continue;
      }

      prevRenderedInternalInstance.receive(nextElement);
      nextRenderedInternalInstanceChildren.push(prevRenderedInternalInstance);
    }

    for (let j = nextElementChildren.length; j < prevElementChildren.length; j++) {
      const prevRenderedInternalInstance = prevRenderedInternalInstanceChildren[j];
      prevRenderedInternalInstance.unmount();

      const prevNode = prevRenderedInternalInstance.getHostNode();
      operationQueue.push({ type: OPERATION.REMOVE, node: prevNode });
    }

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

function instantiateComponent(element) {
  const { type } = element;
  const isHostComponent = typeof type === 'string';
  let internalInstance;

  if (isHostComponent) {
    internalInstance = new HostComponent(element);
  } else {
    internalInstance = new CompositeComponent(element);
  }

  return internalInstance;
}

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

function render(element, containerNode) {
  const firstChildNode = getFirstChildNode(containerNode);

  if (firstChildNode) {
    const prevInternalInstance = firstChildNode[INTERNAL_INSTANCE];

    if (prevInternalInstance) {
      const prevElement = prevInternalInstance.currentElement;

      if (prevElement.type === element.type) {
        prevInternalInstance.receive(element);
        return;
      }
    }

    unmountAll(containerNode);
  }

  const internalInstance = instantiateComponent(element);

  const node = internalInstance.mount();

  node[INTERNAL_INSTANCE] = internalInstance;

  appendNode(containerNode, node);
}

function isClass(type) {
  if (type.isReactComponent) {
    return true;
  }
  return false;
}

function Component(props) {
  this.props = props;
}

Component.isReactComponent = true;

Component.prototype = Object.assign({}, Component.prototype, {
  setState: function setState(state) {
    const nextState = Object.assign({}, state);
    const renderedInternalInstance = this[RENDERED_INTERNAL_INSTANCE];

    this.state = nextState;

    const nextRenderedElement = this.render();
    console.log(this.state);

    if (renderedInternalInstance) {
      renderedInternalInstance.receive(nextRenderedElement);
    }
  },
});

export { render, Component };
