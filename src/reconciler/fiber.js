import {
  HOST_COMPONENT, COMPOSITE_COMPONENT, HOST_ROOT, OPERATION,
  ENOUGH_TIME, ROOT_FIBER, INSTANCE_INNER_FIBER,
} from '../constants';

import {
  createNode, appendNode, replaceNode, removeNode, updateNodeAttributes,
} from '../render/dom';

const taskQueue = [];
let nextUnitWork = null;
let pendingCommit = null;

if (global.requestIdleCallback == null) {
  global.requestIdleCallback = (func) => {
    func({
      timeRemaining: () => 100,
    });
  };
}

function render(elements, containerDom) {
  taskQueue.push({
    tag: HOST_ROOT,
    dom: containerDom,
    props: { children: elements },
  });

  requestIdleCallback(performWork);
}

function updateComponent(instance, partialState) {
  taskQueue.push({
    tag: HOST_COMPONENT,
    instance,
    partialState,
    props: instance.props,
  });

  requestIdleCallback(performWork);
}

function performWork(deadline) {
  workLoop(deadline);

  if (nextUnitWork || taskQueue.length > 0) {
    requestIdleCallback(performWork);
  }
}

function workLoop(deadline) {
  if (nextUnitWork == null) {
    nextUnitWork = resetNextUnitWork();
  }

  if (nextUnitWork && deadline.timeRemaining() > ENOUGH_TIME) {
    nextUnitWork = performUnitWork(nextUnitWork);
  }

  if (pendingCommit) {
    commitAllWork(pendingCommit);
  }
}

function resetNextUnitWork() {
  const task = taskQueue.shift();

  if (task == null) {
    return null;
  }

  if (task.tag === HOST_ROOT) {
    nextUnitWork = {
      tag: HOST_ROOT,
      statNode: task.dom,
      props: task.props,
      alternate: task.dom[ROOT_FIBER],
    };
  } else {
    const currentFiber = task.instance[INSTANCE_INNER_FIBER];
    const getRootFiber = (fiber) => {
      if (fiber.tag !== HOST_ROOT) {
        fiber = fiber.parent;
      }
      return fiber;
    };

    const oldRootFiber = getRootFiber(currentFiber);

    nextUnitWork = {
      tag: HOST_ROOT,
      props: oldRootFiber.props,
      statNode: oldRootFiber.statNode,
      alternate: oldRootFiber,
    };

    if (task.partialState) {
      currentFiber.partialState = task.partialState;
    }
  }
  return nextUnitWork;
}

function performUnitWork(fiber) {
  beginWork(fiber);

  if (fiber.child) {
    return fiber.child;
  }

  while (fiber) {
    completeWork(fiber);
    if (fiber.sibling) {
      return fiber.sibling;
    }

    fiber = fiber.parent;
  }

  return null;
}

function beginWork(fiber) {
  if (fiber.tag === COMPOSITE_COMPONENT) {
    workInCompositeComponent(fiber);
  } else {
    workInHostComponent(fiber);
  }
}

function completeWork(fiber) {
  if (fiber.tag === COMPOSITE_COMPONENT && fiber.statNode != null) {
    fiber.statNode[INSTANCE_INNER_FIBER] = fiber;
  }

  if (fiber.parent) {
    const childEffects = fiber.effects || [];
    const parentEffects = fiber.parent.effects || [];
    fiber.parent.effects = [...parentEffects, ...childEffects, fiber];
  } else {
    pendingCommit = fiber;
  }
}

function workInCompositeComponent(fiber) {
  const {
    type, props, alternate, statNode, partialState,
  } = fiber;

  if (alternate && alternate.props === props && partialState == null) {
    cloneChildrenFiber(fiber);
    return;
  }

  let instance = statNode;

  // 类组件
  const isClassComponent = type.isReactComponent;
  if (isClassComponent) {
    if (instance == null) {
      instance = new type(props);

      // 用来标记组件是否是第一次创建
      instance.isFirstCreate = true;
    } else {
      instance.isFirstCreate = false;
    }

    instance.props = props;
    instance.state = Object.assign({}, instance.state, alternate ? alternate.partialState : null);
  }

  fiber.statNode = instance;

  const childrenElements = instance ? instance.render() : type(props);
  reconcileChildren(fiber, childrenElements);
}

function workInHostComponent(fiber) {
  const { props = {} } = fiber;

  if (fiber.statNode == null) {
    fiber.statNode = createNode({ type: fiber.type, props: fiber.props });
  }

  const childrenElements = props.children;
  reconcileChildren(fiber, childrenElements);
}

function reconcileChildren(fiber, elements) {
  elements = elements == null ? [] : (Array.isArray(elements) ? elements : [elements]);

  let oldChildFiber = fiber.alternate ? fiber.alternate.child : null;
  let newChildFiber = null;

  let index = 0;

  while (index < elements.length || oldChildFiber != null) {
    const prevFiber = newChildFiber;
    const element = elements[index];

    if (element != null) {
      newChildFiber = {
        tag: typeof element.type === 'function' ? COMPOSITE_COMPONENT : HOST_COMPONENT,
        type: element.type,
        props: element.props,
        parent: fiber,
        alternate: oldChildFiber,
      };
    } else {
      newChildFiber = null;
    }

    if (oldChildFiber == null && element != null) {
      newChildFiber.effectTag = OPERATION.ADD;
    }

    if (oldChildFiber != null) {
      if (element == null) {
        oldChildFiber.effectTag = OPERATION.REMOVE;
        fiber.effects = fiber.effects || [];
        fiber.effects.push(oldChildFiber);
      } else if (element != null && oldChildFiber.type !== newChildFiber.type) {
        newChildFiber.effectTag = OPERATION.REPLACE;
      } else if (
        element != null
        && (oldChildFiber.props !== newChildFiber.props
          || oldChildFiber.partialState != null)
      ) {
        newChildFiber.partialState = oldChildFiber.partialState;
        newChildFiber.statNode = oldChildFiber.statNode;
        newChildFiber.effectTag = OPERATION.UPDATE;
      }
    }

    if (oldChildFiber) {
      oldChildFiber = oldChildFiber.sibling;
    }

    if (index === 0) {
      fiber.child = newChildFiber;
    } else {
      prevFiber.sibling = newChildFiber;
    }

    index += 1;
  }
}

function cloneChildrenFiber(parentFiber) {
  let oldFiber = parentFiber.alternate.child;
  let prevFiber = null;

  while (oldFiber != null) {
    const newFiber = {
      ...oldFiber,
      alternate: oldFiber,
      parent: parentFiber,
    };

    if (prevFiber == null) {
      parentFiber.child = newFiber;
    } else {
      prevFiber.sibling = newFiber;
    }

    prevFiber = newFiber;
    oldFiber = oldFiber.sibling;
  }
}

function commitAllWork(rootFiber) {
  const { effects } = rootFiber;

  for (let i = 0; i < effects.length; i++) {
    const fiber = effects[i];
    const parentNodeFiber = upwardUtilNodeFiber(fiber);
    const nodeFiber = downwardUtilNodeFiber(fiber);

    if (nodeFiber) {
      const parentNode = parentNodeFiber.statNode;
      const node = nodeFiber.statNode;

      if (fiber.effectTag === OPERATION.ADD) {
        appendNode(parentNode, node);
      } else if (fiber.effectTag === OPERATION.REPLACE) {
        const prevNodeFiber = downwardUtilNodeFiber(nodeFiber.alternate);

        if (prevNodeFiber) {
          replaceNode(parentNode, node, prevNodeFiber.statNode);
        }
      } else if (fiber.effectTag === OPERATION.REMOVE) {
        removeNode(parentNode, node);
      } else if (fiber.effectTag === OPERATION.UPDATE) {
        if (fiber.tag === HOST_COMPONENT) {
          updateNodeAttributes(node, fiber.props, fiber.alternate.props);
        }
      }
    }

    const fiberInstance = fiber.type.isReactComponent ? fiber.statNode : null;

    // life cycle: componentDidMount
    if (fiberInstance && fiberInstance.isFirstCreate && typeof fiberInstance.componentDidMount === 'function') {
      fiberInstance.componentDidMount();
    }
  }
}

function upwardUtilNodeFiber(fiber) {
  fiber = fiber.parent;
  while (fiber.tag === COMPOSITE_COMPONENT) {
    fiber = fiber.parent;
  }
  return fiber;
}

function downwardUtilNodeFiber(fiber) {
  while (fiber.tag === COMPOSITE_COMPONENT) {
    fiber = fiber.child;
  }
  return fiber;
}

// Component
function Component(props) {
  this.props = props;
}

Component.isReactComponent = true;

Component.prototype = Object.assign({}, Component.prototype, {
  setState: function setState(nextState) {
    updateComponent(this, nextState);
  },
});

export { render, Component };
