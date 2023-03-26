import { renderToString } from 'solid-js/web';
import App from './App';

export default function render(): string {
  return renderToString(() => <App />);
}
