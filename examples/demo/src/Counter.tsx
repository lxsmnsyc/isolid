import { clientComponent$ } from 'isolid';
import { createSignal } from 'solid-js';

interface CountProps {
  initialValue: number;
}

const Counter = clientComponent$<CountProps>((props) => {
  const [count, setCount] = createSignal(props.initialValue);

  function increment() {
    setCount((c) => c + 1);
  }
  function decrement() {
    setCount((c) => c - 1);
  }

  return (
    <div>
      <button type="button" onClick={increment}>
        Increment
      </button>
      <span>
        {`Count: ${count()}`}
      </span>
      <button type="button" onClick={decrement}>
        Decrement
      </button>
    </div>
  );
});

export default Counter;
