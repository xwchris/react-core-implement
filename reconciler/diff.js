export const TEXT_NODE = '@react/__text_node';

// todo async setState
function isClass(type) {
  if (type.isReactComponent) {
    return true;
  }
  return false;
}

export class Component {
  constructor(props) {
    this.props = props;
  }

  setState(state) {
    const nextState = Object.assign({}, state);
    const renderedInternalInstance = this.__rendered_internal_instance;

    this.state = nextState;

    const nextRenderedElement = this.render();
    if (renderedInternalInstance) {
      renderedInternalInstance.receive(nextRenderedElement);
    }
  }
  componentWillMount() {}
  componentDidMount() {}
  componentWillUnMount() {}
  render() {}
}

Component.isReactComponent = true;

class CompositeComponent {
  constructor(element) {
    this.currentElement = element;
    this.publicInstance = null;
    this.renderedInternalInstance = null;
  }

  getHostNode() {
    return this.renderedInternalInstance.getHostNode()
  }

  mount() {
    const element = this.currentElement;
    const { type = (() => {}), props = {} } = element;

    let renderedElement;
    if (isClass(type)) {
      const publicInstance = new type(props);
      // todo lifecycle
      if (typeof publicInstance.componentWillMount === 'function') {
        publicInstance.componentWillMount();
      }

      this.publicInstance = publicInstance;
      renderedElement = publicInstance.render();
    } else {
      renderedElement = type(props);
    }

    const renderedInternalInstance = instantiateComponent(renderedElement);

    this.renderedInternalInstance = renderedInternalInstance;

    if (this.publicInstance) {
      this.publicInstance.__rendered_internal_instance = renderedInternalInstance;
    }

    const node = renderedInternalInstance.mount();

    if (this.publicInstance && typeof this.publicInstance.componentDidMount === 'function') {
      this.publicInstance.componentDidMount();
    }

    return node;
  }

  unmount() {
    const publicInstance = this.publicInstance;
    const renderedInternalInstance = this.renderedInternalInstance;

    if (publicInstance && typeof publicInstance.componentWillUnMount === 'function') {
      publicInstance.componentWillUnMount();
    }

    renderedInternalInstance.unmount();
  }

  receive(element) {
    const prevRenderedInternalInstance = this.renderedInternalInstance;
    const prevRenderedElement = prevRenderedInternalInstance.currentElement;

    const type = element.type;
    const nextProps = element.props || {};

    const publicInstance = this.publicInstance;
    publicInstance.props = nextProps;

    let nextRenderedElement;

    if (isClass(type)) {
      nextRenderedElement = publicInstance.render();
    } else {
      nextRenderedElement = type(nextProps);
    }

    if (prevRenderedElement.type === nextRenderedElement.type) {
      renderedInternalInstance.receive(nextRenderedElement);
      return;
    }

    const prevNode = prevRenderedInternalInstance.getHostNode();

    const nextRenderedInternalInstance = instantiateComponent(nextRenderedElement);
    const nextNode = nextRenderedInternalInstance.getHostNode();

    if (prevNode.parentNode) {
      prevNode.parentNode.replaceChild(nextNode, prevNode);
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

    const { type = '', props = {} } = element;

    let node;
    if (type === TEXT_NODE) {
      const textContent = props.textContent || '';
      node = document.createTextNode(textContent);
    } else {
      node = document.createElement(type);

      Object.keys(props).forEach(propName => {
        if (propName !== 'children') {
          node.setAttribute(propName, props[propName]);
        }
      });
    }

    this.node = node;

    let children = props.children || [];
    if (!Array.isArray(children)) {
      children = [children];
    }

    const renderedInternalInstanceChildren = children.map(instantiateComponent);
    const nodeChildren = renderedInternalInstanceChildren.map(child => child.mount());

    this.renderedInternalInstanceChildren = renderedInternalInstanceChildren;

    nodeChildren.forEach(nodeChild => node.appendChild(nodeChild));

    return node;
  }

  unmount() {
    const renderedInternalInstanceChildren = this.renderedInternalInstanceChildren;
    const node = this.node;

    if (renderedInternalInstanceChildren) {
      renderedInternalInstanceChildren.forEach(child => {
        child.unmount();
        const childNode = child.getHostNode();
        node.removeChild(childNode);
      });
    }
  }

  receive(element) {
    const prevProps = this.currentElement.props;

    const type = element.type;
    const nextProps = element.props || {};

    const node = this.node;

    if (type !== TEXT_NODE) {
      Object.keys(prevProps).forEach(propName => {
        if (propName !== 'children' && !nextProps.hasOwnProperty(propName)) {
          node.removeAttribute(propName);
        }
      });

      Object.keys(nextProps).forEach(propName => {
        if (propName !== 'children') {
          node.setAttribute(propName, nextProps[propName]);
        }
      });
    } else {
      node.textContent = nextProps.textContent || '';
    }

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

        operationQueue.push({ type: 'ADD', node: nextNode });
        continue;
      }

      const canUpdate = prevElement.type === nextElement.type;

      if (!canUpdate) {
        const nextRenderedInternalInstance = instantiateComponent(nextElement);
        const nextNode = nextRenderedInternalInstance.getHostNode();

        const prevNode = prevRenderedInternalInstance.getHostNode();

        nextRenderedInternalInstanceChildren.push(nextRenderedInternalInstance);

        operationQueue.push({ type: 'REPLACE', prevNode, nextNode });
        continue;
      }

      prevRenderedInternalInstance.receive(nextElement);
      nextRenderedInternalInstanceChildren.push(prevRenderedInternalInstance);
    }

    for (let j = nextElementChildren.length; j < prevElementChildren.length; j++) {
      const prevRenderedInternalInstance = prevRenderedInternalInstanceChildren[j];
      prevRenderedInternalInstance.unmount();

      const prevNode = prevRenderedInternalInstance.getHostNode();
      operationQueue.push({ type: 'REMOVE', node: prevNode });
    }

    while (operationQueue.length > 0) {
      const operation = operationQueue.shift();

      switch (operation.type) {
        case 'ADD':
          node.appendChild(operation.node);
          break;
        case 'REMOVE':
          node.removeChild(operation.node);
          break;
        case 'REPLACE':
          node.replaceChild(operation.nextNode, operation.prevNode);
          break;
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

export function render(element, containerNode) {
  const internalInstance = instantiateComponent(element);

  unmountAll(containerNode);

  const node = internalInstance.mount();

  node.__internal_instance = internalInstance;

  containerNode.appendChild(node);
}

export function unmountAll(containerNode) {
  const firstChild = containerNode.firstChild;

  if (firstChild) {
    const rootInternalInstance = firstChild.__internal_instance;

    if (rootInternalInstance) {
      rootInternalInstance.unmount();
      const rootNode = rootInternalInstance.getHostNode();
      containerNode.removeChild(rootNode);
    } else {
      containerNode.innerHTML = '';
    }
  }
}
