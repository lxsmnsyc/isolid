import { JSX } from 'solid-js';
import { HydrationScript } from 'solid-js/web';
import Counter from './Counter';
import Main from './Main';

export default function App(): JSX.Element {
  return (
    <html lang="en">
      <head>
        <script type="module" src="/@vite/client" />
        <title>Solid Server Components</title>
        <style>
          {'isolid-root, isolid-frame, isolid-fragment { display: contents; }'}
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
        <main>
          <Main title="Counter app example">
            <Counter client:media="(orientation: portrait)" initialValue={100} />
            <p>This is a server-side paragraph.</p>
          </Main>
        </main>
      </body>
    </html>
  );
}
