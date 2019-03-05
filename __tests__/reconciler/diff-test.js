import { render, Component } from '../../reconciler/diff';
import { h } from '../../render/createElement';

describe('render test', () => {
  document.body.innerHTML = '<div id="root"></div>';
  const $root = document.getElementById('root');

  test('mount element which type is string', () => {
    const element = (<div style="color: red">hello world</div>);

    render(element, $root);

    const expectHTML = '<div style="color: red">hello world</div>';
    expect($root.innerHTML).toBe(expectHTML);
  });


  test('mount element which type is pure function', () => {
    const Container = ({ name }) => (<h1>{`hello ${name}`}</h1>)

    const element = <Container name="xiaowei" />

    render(element, $root);

    const expectHTML = '<h1>hello xiaowei</h1>';
    expect($root.innerHTML).toBe(expectHTML);
  });


  test('mount element which type is class', () => {
    class Container extends Component {
      render() {
        const { name } = this.props;
        return (<h1>{`hello ${name}`}</h1>);
      }
    }

    const element = <Container name="xiaowei" />

    render(element, $root);

    const expectHTML = '<h1>hello xiaowei</h1>';
    expect($root.innerHTML).toBe(expectHTML);
  });
});

describe('setState test', () => {
  document.body.innerHTML = '<div id="root"></div>';
  const $root = document.getElementById('root');

  test('state change', () => {
    class Container extends Component {
      constructor(props) {
        super(props);

        this.state = {
          count: 0
        }
      }

      componentDidMount() {
        this.setState({
          count: this.state.count + 1
        })
      }

      componentWillUpdate(nextProps, nextState) {
        console.log('next', this.state, nextState);
      }

      render() {
        const { count } = this.state;

        return (<h1 id="count">{count}</h1>);
      }
    }

    const element = <Container />;

    render(element, $root);

    const expectHTML = '<h1 id="count">1</h1>';
    expect($root.innerHTML).toBe(expectHTML);
  })
})
