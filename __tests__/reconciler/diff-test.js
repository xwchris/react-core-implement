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
    const element = {
      type: Container,
      props: {
        name: 'xiaowei'
      },
      children: [Container]
    }

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

    const element = {
      type: Container,
      props: {
        name: 'xiaowei'
      },
      children: [Container]
    }

    render(element, $root);

    const expectHTML = '<h1>hello xiaowei</h1>';
    expect($root.innerHTML).toBe(expectHTML);
  });
})
