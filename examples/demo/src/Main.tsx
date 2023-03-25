import { clientComponent$ } from 'isolid';

interface MainProps {
  title: string;
}

const Main = clientComponent$<MainProps>((props) => (
  <main>
    <h1>Counter App Example</h1>
    {props.children}
  </main>
));

export default Main;
