![last commit](https://img.shields.io/github/last-commit/xwchris/collection.svg?style=flat)
![xwchris](https://img.shields.io/maintenance/xwchris/2019.svg?style=flat)
![issues](https://img.shields.io/github/issues/xwchris/collection.svg?style=flat)

# react-core-implement

> 该仓库的目标是学习和理解React的核心实现原理，包括React中的`reconcile`算法的实现，以及渲染器的实现。

## 如何开始
快速查看实现后效果，你可以使用如下命令

```bash
git clone git@github.com:xwchris/react-core-implement.git

npm i && npm start
```

然后你就能在浏览器的中使用`http://localhost:8080/`地址来查看效果

实际代码部分在`src`文件夹中查看，为了更好的理解，你可以参阅下面的部分👇

## 预备知识
`React`是一套用户界面框架，本质上它帮我们做了数据到界面的转换工作，当然其中包括各种优化以方便数据流动和提高渲染效率。为了开始我们后面的知识，我们先了解一些基本的概念。

### Element
`element`就是常说的虚拟节点。本质上，它其实就是一个对象，存储着需要渲染所有信息。它的结构如下：

```javascript
{
  type: Function | String,
  props: Object
  children: String | Object | Array
}
```

`type`用来表示需要渲染节点的类型，如果是字符串则通常是`div`、`p`之类的形式，用来表示渲染的dom节点类型。如果是函数则表示是一个组件，如`Container`等。

`props`属性存储有各种节点渲染需要的属性。

`children`属性存储该节点的后代节点，通常为一个数组或者对象，当然它也有可能为空。在实际实现过程中为了方便统一处理，我们通常将`children`属性拷贝放入`props`中。

实际开发中这种直接用对象的方式来书写显得有些麻烦，所以为了提高开发效率，React团队推出 了`JSX`语法。`JSX`本质上一种语法糖，例如

```html
<div className="container">
  <h1>hello world</h1>
</div>
```

与

```javascript
{
  type: 'div',
  props: { className: 'container' },
  children: {
    type: 'h1',
    children: 'hello world'
  }
}
```

是对应的，它们之间的转化可以通过`@babel/plugin-transform-react-jsx`插件来帮助我们进行。

# Diff
dom节点的渲染是一件耗费性能的事情，理所当然的，为了提升渲染效率我们需要尽可能地复用已经存在的节点。因此利用我们前面提到的`element`，我们可以先比较需要新渲染的`element`与之前的节点（可以是旧的element，也可以直接与dom节点进行比较，preact就是如此实现）的异同，来确认我们可以复用的节点，不再需要重新渲染。这就是diff的过程。

我们知道渲染树的一棵多叉树，如果我们完全比较前后两棵树那么时间复杂度将达到`O(n^3)`。这里React团队用一种虽然简单但是强大的技巧来将复杂度降到了`O(n)`。他们做了两个假设，假设如下：

- 如果节点类型不同，那么说明它们渲染出的树不同
- 列表用key标识，key是稳定且不重复的，key不同则节点不同

这两个假设让我们只需要比较同层之间的节点就可以，复杂度直接降到了`O(n)`。对于一些极端情况可能损失了一些性能，但从整体上来看，性能有非常大的提升。

![1286899590-56d41b839c27f](https://user-images.githubusercontent.com/13817144/54080534-0819ab00-432d-11e9-992c-3e40860a53b7.png)

# Fiber
上面提到React是一个用户界面框架，它帮我们做数据到用户界面的转换。框架的类型分为两种，一种是`push`类型的，另外一种是`pull`类型的。`push`类型的是由使用者（即程序员）来控制，而`pull`类型的是由框架来控制。React是属于`pull`类型的，界面如何渲染，如何统筹由React来控制更加便于使用，而不是我们自己。

为了创造更好的用户体验，React需要对数据流向和用户界面渲染时机进行控制。由于js是单线程的，在React15及之前版本中一直存在一个问题，React应该如何更有效的控制渲染？动画、用户输入、界面更新等操作应该何时响应？优先级又是如何？为了更有效的控制更新和渲染，我们需要一种机制。

我们都知道js的执行，是在栈中进行的，直到栈为空之前，需要一直执行下去。在之前的版本，由于React不能控制，所以当更新执行的时候，其他的例如动画等会出现卡的情况。为了解决这个问题，React需要构建一个虚拟栈，一种类似于栈的机制，来更有效的控制各个节点的操作，简单来说，为了达到以下目的：

- 能够打断和恢复节点操作状态
- 能够更好的调度统筹优先级不同的操作

为了保持用户界面的一致性，因此真实dom渲染的时候我们应该是连续的。所以我们应该在节点reconcile阶段来实现这种机制。因此就有了`fiber`。

`fiber`本质上也是一个对象。从功能上来说，它就是我们上面提到的虚拟栈的栈帧。每个`element`对应一个`fiber`。`fiber`中除了存储有对应的`element`节点的相关属性还存储有它与其他fiber节点的关系和其相关状态操作等信息。

`element`树最终对应的就是一个`fiber`树，每次更新操作，我们生成一个新的`fiber`树。

最后我们看下`fiber`的结构（并不代表React中实际实现的真正结构）

```javascript
{
  // 标记节点类型 是dom还是组件
  tag,
  // 与element中的type相同
  type,
  // 与element中的props相同
  props,
  // 对应的实际的dom或组件的instance
  statNode,

  // 部分组件fiber需要更新的state
  partialState,

  // 该节点的父节点
  parent,
  // 该节点的子节点
  child,
  // 该节点的下一个兄弟节点
  sibling,

  // 要进行的操作状态
  effectTag,
  // 所有操作的后代节点
  effects,
}
```

`fiber`树的结构，盗用大佬的一张图
![1_tc8Jcye70jRI79dmI4PUcw](https://user-images.githubusercontent.com/13817144/54081431-e970df80-433f-11e9-9022-1b6474e2a3c1.png)

## 代码实现
自己动手代码实现能帮助我们更好的理解这些概念，更好的使用React。理解和吸收这些设计理念是我们自己永远的财富。

为了更好的对照代码，代码注释都包含在源码中，请自己参照源码阅读。

实际的React使用同一个`reconcile`核心，在不同的环境中使用不同的渲染器`react-dom`和`react-native`。我们在实现中也采用了这种思想，将调度器与渲染器分离。`reconcile`位于`src/reconciler`中，`diff.js`文件是React15之前简单diff的简单实现。`fiber.js`是fiber的简单实现。

为了尽可能的简单，我们主要实现了渲染和更新核心的部分。我们抛弃了一些部分，如

- 组件完整的声明周期(为了测试更新只实现了componentDidMount，感兴趣的可以自己实现)
- state合成异步更新
- 合成事件
- svg等元素的处理

对于fiber来说，实际的fiber实现包括优先级控制，错误边界，动画渲染等部分我们都未在这里实现。

## 参考资料

### 文章列表
- [Design Principles](https://reactjs.org/docs/design-principles.html)
- [Implementation Notes](https://reactjs.org/docs/implementation-notes.html)
- [React Fiber Architecture](https://github.com/acdlite/react-fiber-architecture)
- [Inside Fiber: in-depth overview of the new reconciliation algorithm in React](https://medium.com/react-in-depth/inside-fiber-in-depth-overview-of-the-new-reconciliation-algorithm-in-react-e1c04700ef6e)
- [Didact Fiber: Incremental reconciliation](https://engineering.hexacta.com/didact-fiber-incremental-reconciliation-b2fe028dcaec)

### 视频列表
- [Lin Clark - A Cartoon Intro to Fiber - React Conf 2017](https://www.youtube.com/watch?v=ZCuYPiUIONs)

## 拓展资源/仓库
- [react-fiber-implement](https://github.com/tranbathanhtung/react-fiber-implement)
- [react-fiber-resources](https://github.com/koba04/react-fiber-resources)
- [snabbdom](https://github.com/snabbdom/snabbdom)
