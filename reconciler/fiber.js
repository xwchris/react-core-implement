import {
  HOST_COMPONENT, COMPOSITE_COMPONENT, HOST_ROOT, OPERATION, ENOUGH_TIME, ROOT_FIBER,
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

  if (task.tag === HOST_ROOT) {
    const oldRootFiber = task.dom[ROOT_FIBER];

    nextUnitWork = {
      tag: HOST_ROOT,
      statNode: task.dom,
      props: task.props,
      alternate: oldRootFiber,
    };
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
  if (fiber.parent) {
    const childEffects = fiber.effects || [];
    const parentEffects = fiber.parent.effects || [];
    fiber.parent.effects = [...parentEffects, ...childEffects, fiber];
  } else {
    pendingCommit = fiber;
  }
}

function workInCompositeComponent(fiber) {
  // alternate fiber
  const {
    type, props, alternate, statNode,
  } = fiber;
  const isClassComponent = type.isReactComponent;

  if (alternate && alternate.props === props) {
    cloneChildrenFiber(fiber);
    return;
  }

  let instance = statNode;
  if (isClassComponent && instance == null) {
    instance = new type(props);
  }

  if (isClassComponent) {
    instance.props = props;
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

  const oldChildFiber = fiber.child;
  let newChildFiber = null;

  let index = 0;

  if (index < elements.length || oldChildFiber != null) {
    const prevFiber = newChildFiber;
    const element = elements[index];

    newChildFiber = {
      tag: typeof element.type === 'function' ? COMPOSITE_COMPONENT : HOST_COMPONENT,
      type: element.type,
      props: element.props,
      parent: fiber,
      alternate: oldChildFiber,
    };

    if (oldChildFiber == null && element != null) {
      newChildFiber.effectTag = OPERATION.ADD;
    }

    if (oldChildFiber != null) {
      if (element == null) {
        oldChildFiber.effectTag = OPERATION.REMOVE;
        fiber.effects = fiber.effects || [];
        fiber.effects.push(oldChildFiber);
      } else if (element != null && oldChildFiber.type !== newChildFiber.type) {
        fiber.effectTag = OPERATION.REPLACE;
      } else if (element != null && oldChildFiber.props !== newChildFiber.props) {
        fiber.effectTag = OPERATION.UPDATE;
      }
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

function Component(props) {
  this.props = props;
}

Component.isReactComponent = true;

export { render, Component };
