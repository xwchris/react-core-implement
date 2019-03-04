export const TEXT_NODE = '@react/__text_node';

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

  componentWillMount() {}
  componentWillUpdate() {}
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

  // input: undefined, output: node
  mount() {
    // tip: element props and type required
    const element = this.currentElement;
    const { type = (() => {}), props = {} } = element;

    let renderedElement;
    if (isClass(type)) {
      const publicInstance = new type(props);
      if (typeof publicInstance.componentWillMount === 'function') {
        publicInstance.componentWillMount();
      }

      this.publicInstance = publicInstance;
      // tip: publicInstance render function required
      renderedElement = publicInstance.render();
    } else {
      renderedElement = type(props);
    }

    const renderedInternalInstance = instantiateComponent(renderedElement);

    this.renderedInternalInstance = renderedInternalInstance;

    return renderedInternalInstance.mount();
  }

  unmount() {
    const publicInstance = this.publicInstance;
    const renderedInternalInstance = this.renderedInternalInstance;

    if (publicInstance && typeof publicInstance.componentWillUnMount === 'function') {
      publicInstance.componentWillUnMount();
    }

    renderedInternalInstance.unmount();
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
    // tip: type required to be valid dom type
    const { type = '', props = {} } = element;

    let node;
    if (type === TEXT_NODE) {
      const textContent = props.textContent || '';
      node = document.createTextNode(textContent);
    } else {
      node = document.createElement(type);

      Object.keys(props).forEach(propName => {
        if (propName !== 'children') {
          node.setAttribute(propName, props[propName])
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
