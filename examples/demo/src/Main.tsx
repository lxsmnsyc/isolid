import { clientComponent$ } from 'isolid';
import { createSignal, onMount } from 'solid-js';

export default function Main() {
  // This value is only evaluated on the server!
  const initialValue = Math.random() * 1000;

  const Counter = clientComponent$(() => {
    const [count, setCount] = createSignal(initialValue);

    function increment() {
      setCount((c) => c + 1);
    }
    function decrement() {
      setCount((c) => c - 1);
    }

    onMount(() => {
      console.log('Counter mounted');
    });

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

  return (
    <main>
      <h1>Counter App</h1>
      <p>{`Counter has an initial state of ${initialValue} generated from the server.`}</p>
      <Counter client:interaction />
      <p>This is a server-side paragraph.</p>
    </main>
  );
}
