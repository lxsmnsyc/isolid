import { renderToStringAsync } from 'solid-js/web';
import App from './App';

export default async function render() {
  return renderToStringAsync(() => <App />);
}
