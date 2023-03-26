import { ServerValue, serialize } from 'seroval';
import {
  createComponent,
  createUniqueId,
  JSX,
  mergeProps,
  splitProps,
} from 'solid-js';
import {
  escape,
  renderToString,
  ssr,
  ssrAttribute,
  ssrHydrationKey,
} from 'solid-js/web';
import assert from '../shared/assert';
import { CLIENT_PROPS, getServerComponentPath, SERVER_PROPS } from '../shared/constants';
import {
  ClientComponent,
  ClientProps,
  SerializableProps,
  ServerComponent,
  ServerProps,
} from '../shared/types';

let SCOPE: ServerValue[];

function runWithScope<T>(scope: ServerValue[], callback: () => T): T {
  const parent = SCOPE;
  SCOPE = scope;
  try {
    return callback();
  } finally {
    SCOPE = parent;
  }
}

export function $$scope(): ServerValue[] {
  assert(SCOPE, 'Unexpected use of $$scope');
  return SCOPE;
}

const REGISTRATION = new Map<string, ServerComponent<any>>();

export function $$server<P extends SerializableProps>(
  id: string,
  Comp: ClientComponent<P>,
  scope: () => ServerValue[],
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

const ROOT = ['<isolid-frame', '><isolid-root>', '</isolid-root><template>', '</template><script type="module">', '</script></isolid-frame>'];
const FRAGMENT = ['<isolid-fragment', '>', '</isolid-fragment>'];

export function $$client<P extends SerializableProps>(
  id: string,
  Comp: ClientComponent<P>,
  scope: () => ServerValue[],
): ClientComponent<ClientProps<P>> {
  return function ClientComp(props: ClientProps<P>): JSX.Element {
    const root = createUniqueId();
    const [local, rest] = splitProps(props, CLIENT_PROPS);

    let fragment: JSX.Element;

    const getRoot = () => {
      if (local['client:only']) {
        return '';
      }
      if ('children' in rest) {
        return renderToString(() => (
          runWithScope(scope(), () => (
            createComponent(Comp, mergeProps(rest, {
              get children() {
                fragment = ssr(
                  FRAGMENT,
                  ssrHydrationKey(),
                  escape(rest.children as string),
                ) as unknown as JSX.Element;
                return fragment;
              },
            }) as P)
          ))
        ), {
          renderId: root,
        });
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

    const [, serializable] = splitProps(rest, ['children']);
    const serializedProps = serialize(serializable as ServerValue);
    const strategyProps = serialize(local);
    const serializedScope = serialize(scope());

    return ssr(
      ROOT,
      ssrHydrationKey() + ssrAttribute('root-id', root as unknown as boolean),
      getRoot(),
      fragment,
      `import "/__isolid/${id}.js";window.__ISOLID__[${JSON.stringify(id)}]("${root}",${String('children' in props)},${serializedProps},${strategyProps},${serializedScope});`,
    ) as unknown as JSX.Element;
  };
}
