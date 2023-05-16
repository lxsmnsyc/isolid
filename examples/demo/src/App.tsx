import { JSX } from 'solid-js';
import { HydrationScript } from 'solid-js/web';
import Main from './Main';

export default function App(): JSX.Element {
  return (
    <html lang="en">
      <head>
        <script type="module" src="/@vite/client" />
        <title>Solid Server Components</title>
        <style>
          {'isolid-island, isolid-frame, isolid-fragment { display: contents; }'}
        </style>
        <HydrationScript />
        <style>
          {`
            main {
              display: flex;
              flex-direction: column;
            }
            div {
              display: flex;
            }
          `}
        </style>
      </head>
      <body>
        <Main />
      </body>
    </html>
  );
}
