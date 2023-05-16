import { serialize } from 'seroval';
import type { JSX } from 'solid-js';
import {
  createComponent,
  createUniqueId,
  splitProps,
} from 'solid-js';
import {
  renderToString,
  ssr,
  ssrAttribute,
  ssrHydrationKey,
} from 'solid-js/web';
import assert from '../shared/assert';
import { CLIENT_PROPS, getServerComponentPath, SERVER_PROPS } from '../shared/constants';
import type {
  ClientComponent,
  ClientProps,
  SerializableProps,
  ServerComponent,
  ServerProps,
} from '../shared/types';

let SCOPE: unknown[];

function runWithScope<T>(scope: unknown[], callback: () => T): T {
  const parent = SCOPE;
  SCOPE = scope;
  try {
    return callback();
  } finally {
    SCOPE = parent;
  }
}

export function $$scope(): unknown[] {
  assert(SCOPE, 'Unexpected use of $$scope');
  return SCOPE;
}

const REGISTRATION = new Map<string, ServerComponent<any>>();

export function $$server<P extends SerializableProps>(
  id: string,
  Comp: ClientComponent<P>,
  scope: () => unknown[],
): ServerComponent<ServerProps<P>> {
  function ServerComp(props: ServerProps<P>): JSX.Element {
    const [, rest] = splitProps(props, SERVER_PROPS);
    return runWithScope(
      scope(),
      () => createComponent(Comp, rest as unknown as P),
    );
  }
  REGISTRATION.set(getServerComponentPath(id), Comp);
  return ServerComp;
}

const ROOT = ['<isolid-frame', '><isolid-root>', '</isolid-root><script type="module">', '</script></isolid-frame>'];

export function $$client<P extends SerializableProps>(
  id: string,
  Comp: ClientComponent<P>,
  scope: () => unknown[],
): ClientComponent<ClientProps<P>> {
  return function ClientComp(props: ClientProps<P>): JSX.Element {
    const root = createUniqueId();
    const [local, rest] = splitProps(props, CLIENT_PROPS);

    let fragment: JSX.Element;

    const getRoot = (): string => {
      if (local['client:only']) {
        return '';
      }

      return renderToString(() => (
        runWithScope(
          scope(),
          () => createComponent(Comp, rest as P),
        )
      ), {
        renderId: root,
      });
    };

    const serializedProps = serialize(rest);
    const strategyProps = serialize(local);
    const serializedScope = serialize(scope());

    return ssr(
      ROOT,
      ssrHydrationKey() + ssrAttribute('root-id', root as unknown as boolean),
      getRoot(),
      fragment,
      `import "/__isolid/client/${id}.js";window.__ISOLID__[${JSON.stringify(id)}]("${root}",${serializedProps},${strategyProps},${serializedScope});`,
    ) as unknown as JSX.Element;
  };
}
