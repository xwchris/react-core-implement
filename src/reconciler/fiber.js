/**
 * fiber简单实现
 *
 * 参考和修改于 https://engineering.hexacta.com/didact-fiber-incremental-reconciliation-b2fe028dcaec 更多详细解释请阅读该文章
 */

import {
  HOST_COMPONENT, COMPOSITE_COMPONENT, HOST_ROOT, OPERATION,
  ENOUGH_TIME, ROOT_FIBER, INSTANCE_INNER_FIBER,
} from '../constants';

import {
  createNode, appendNode, replaceNode, removeNode, updateNodeAttributes,
} from '../render/dom';

// 任务队列，渲染和更新任务都会进入该队列
const taskQueue = [];
// 下一个需要操作的fiber
let nextUnitWork = null;
// 所有操作完成后，会将该值赋值为跟节点
let pendingCommit = null;

// requestIdleCallback函数在现代浏览器中都有实现
// 它会在浏览器空闲的时候执行回调操作，并报告有多少剩余时间
// 为了在非浏览环境测试，当不存在该函数的时候简单实现
if (global.requestIdleCallback == null) {
  global.requestIdleCallback = (func) => {
    func({
      timeRemaining: () => 100,
    });
  };
}

// 渲染函数
function render(elements, containerDom) {
  // 初次渲染，创建一个任务包含根节点和要渲染元素的信息
  taskQueue.push({
    tag: HOST_ROOT,
    dom: containerDom,
    props: { children: elements },
  });

  // 开始执行任务
  requestIdleCallback(performWork);
}

// 更新函数
function updateComponent(instance, partialState) {
  // 添加更新任务，包含更新信息
  taskQueue.push({
    tag: HOST_COMPONENT,
    instance,
    partialState,
    props: instance.props,
  });

  // 开始执行任务
  requestIdleCallback(performWork);
}

// 任务执行
function performWork(deadline) {
  // 执行任务
  workLoop(deadline);

  // 如果还有任务需要执行则继续在浏览器空闲时候执行
  if (nextUnitWork || taskQueue.length > 0) {
    requestIdleCallback(performWork);
  }
}

function workLoop(deadline) {
  // 当下一个需要的fiber为空的时候获取一个
  if (nextUnitWork == null) {
    nextUnitWork = resetNextUnitWork();
  }

  // 如果有下一个任务并且事件足够，那么就开始执行该任务
  if (nextUnitWork && deadline.timeRemaining() > ENOUGH_TIME) {
    nextUnitWork = performUnitWork(nextUnitWork);
  }

  // 如果所有任务执行完毕则提交所有任务
  if (pendingCommit) {
    commitAllWork(pendingCommit);
  }
}

/**
 * 获取下一个要操作的fiber
 *
 * 由于我们更新或渲染的过程就是构建fiber树的过程，故每次都是从根fiber开始
 */
function resetNextUnitWork() {
  // 获取最新的任务
  const task = taskQueue.shift();

  if (task == null) {
    return null;
  }

  if (task.tag === HOST_ROOT) {
    // 如果是根节点则创建一个根fiber
    nextUnitWork = {
      tag: HOST_ROOT,
      statNode: task.dom,
      props: task.props,
      alternate: task.dom[ROOT_FIBER],
    };
  } else {
    // 更新组件fiber属性
    const currentFiber = task.instance[INSTANCE_INNER_FIBER];
    const getRootFiber = (fiber) => {
      if (fiber.tag !== HOST_ROOT) {
        fiber = fiber.parent;
      }
      return fiber;
    };

    // 寻找旧的根节点
    const oldRootFiber = getRootFiber(currentFiber);

    // 创建根节点
    nextUnitWork = {
      tag: HOST_ROOT,
      props: oldRootFiber.props,
      statNode: oldRootFiber.statNode,
      alternate: oldRootFiber,
    };

    // 记录要更新的state
    if (task.partialState) {
      currentFiber.partialState = task.partialState;
    }
  }

  return nextUnitWork;
}

// 执行fiber
function performUnitWork(fiber) {
  // 开始执行fiber
  beginWork(fiber);

  // 采用深度优先遍历fiber树，先遍历孩子节点
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

/**
 * fiber执行的过程实际上就是新的fiber树创建的过程
 * 新的fiber树节点叫做work-in-process fiber
 * 旧的fiber树节点叫做current fiber
 *
 * 从根fiber开始，每次fiber创建自己的孩子fiber并与旧的fiber进行关联方便进行操作
 */
function beginWork(fiber) {
  if (fiber.tag === COMPOSITE_COMPONENT) {
    // 组件fiber执行
    workInCompositeComponent(fiber);
  } else {
    // dom fiber执行
    workInHostComponent(fiber);
  }
}

/**
 * 完成fiber后处理
 *
 * 将各fiber的操作以及它需要操作的孩子fiber都提交到父fiber
 * 以便于最后直接在根fiber拿到所有需要操作的fiber节点
 */
function completeWork(fiber) {
  // 在组件的实例中存储该fiber便于后面更新进行调用
  if (fiber.tag === COMPOSITE_COMPONENT && fiber.statNode != null) {
    fiber.statNode[INSTANCE_INNER_FIBER] = fiber;
  }

  // 向父fiber提交所有操作
  if (fiber.parent) {
    const childEffects = fiber.effects || [];
    const parentEffects = fiber.parent.effects || [];
    fiber.parent.effects = [...parentEffects, ...childEffects, fiber];
  } else {
    pendingCommit = fiber;
  }
}

// 组件fiber处理
function workInCompositeComponent(fiber) {
  const {
    type, props, alternate, statNode, partialState,
  } = fiber;

  // 如果props相同并且没有新的的state则直接克隆子fiber就可以
  if (alternate && alternate.props === props && partialState == null) {
    cloneChildrenFiber(fiber);
    return;
  }

  // 类组件需要实例如果没有没创建一个
  let instance = statNode;

  // 类组件判断
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

  // 获取渲染的节点
  const childrenElements = instance ? instance.render() : type(props);
  // 子fiber构建
  reconcileChildren(fiber, childrenElements);
}

// dom fiber处理
function workInHostComponent(fiber) {
  const { props = {} } = fiber;

  // 如果没有对应的节点 则创建一个方便后面使用
  if (fiber.statNode == null) {
    fiber.statNode = createNode({ type: fiber.type, props: fiber.props });
  }

  // 子fiber构建
  const childrenElements = props.children;
  reconcileChildren(fiber, childrenElements);
}

// 构建子fiber
function reconcileChildren(fiber, elements) {
  // 统一处理都变成数组
  elements = elements == null ? [] : (Array.isArray(elements) ? elements : [elements]);

  let oldChildFiber = fiber.alternate ? fiber.alternate.child : null;
  let newChildFiber = null;

  let index = 0;

  /**
   * 循环遍历对子fiber进行比较，创建新的fiber，并进行连接
   *
   * 操作种类
   * 1. 旧fiber不存在则说明需要进行添加操作，创建该fiber，并标记effectTag为ADD操作
   * 2. 旧fiber存在，但是新的element不存在，则说明该fiber需要删除，将其effectTag标记为DELETE并提交给父fiber（因为我们后面向上提交只会遍历新的fiber）
   * 3. 旧fiber存在，同时新的element存在，类型相同就将effectTag标记为UPDATE操作否则为REPLACE操作
   */
  while (index < elements.length || oldChildFiber != null) {
    const prevFiber = newChildFiber;
    const element = elements[index];

    // element不为空则创建新的fiber
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

    // 判断各fiber需要进行的操作
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

    // 进行新fiber连接
    if (index === 0) {
      fiber.child = newChildFiber;
    } else {
      prevFiber.sibling = newChildFiber;
    }

    index += 1;
  }
}

/**
 * 克隆子fiber
 *
 * 直接进行遍历复制 更改父fiber指向
 */
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

/**
 * 提交阶段就是对所有需要操作的fiber进行遍历，将他们的结果呈现在浏览器
 *
 * 由于fiber完成的时候我们会将自己的操作以及需要操作的子fiber提交上去
 * 所以我们可以在根fiber上拿到所有需要操作的fiber
 */
function commitAllWork(rootFiber) {
  const { effects } = rootFiber;

  // 遍历effects
  for (let i = 0; i < effects.length; i++) {
    const fiber = effects[i];
    const parentNodeFiber = upwardUtilNodeFiber(fiber);
    const nodeFiber = downwardUtilNodeFiber(fiber);

    if (nodeFiber) {
      const parentNode = parentNodeFiber.statNode;
      const node = nodeFiber.statNode;

      // 进行各fiber的增加、替换、移除和更新操作
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

    // 如果是类fiber并且使第一次执行则执行componentDidMount
    if (fiberInstance && fiberInstance.isFirstCreate && typeof fiberInstance.componentDidMount === 'function') {
      fiberInstance.componentDidMount();
    }
  }
}

// 向上查询fiber树查找最近的dom fiber
function upwardUtilNodeFiber(fiber) {
  fiber = fiber.parent;
  while (fiber.tag === COMPOSITE_COMPONENT) {
    fiber = fiber.parent;
  }
  return fiber;
}

// 向下查询fiber树查找最近的dom fiber
function downwardUtilNodeFiber(fiber) {
  while (fiber.tag === COMPOSITE_COMPONENT) {
    fiber = fiber.child;
  }
  return fiber;
}

// 组件类
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
