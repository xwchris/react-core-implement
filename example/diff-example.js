import { render, Component } from '../src/reconciler/diff';
import h from '../src/h';

class Container extends Component {
  constructor(props) {
    super(props);

    this.state = {
      count: 0
    }
  }

  addCount() {
    this.setState({
      count: this.state.count + 1
    })
  }

  render() {
    const { count } = this.state;

    return (
      <div>
        <h1>Diff: {count}</h1>
        <button onClick={() => { this.setState({ count: this.state.count + 1})}}>+</button>
      </div>
    );
  }
}

const element = <Container />;

render(element, document.getElementById('diff-root'));
