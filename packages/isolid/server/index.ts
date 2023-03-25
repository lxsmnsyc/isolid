import { AsyncServerValue, serializeAsync } from 'seroval';
import {
  createComponent,
  createResource,
  createUniqueId,
  JSX,
  mergeProps,
  splitProps,
  Suspense,
} from 'solid-js';
import {
  escape,
  renderToStringAsync,
  ssr,
  ssrAttribute,
  ssrHydrationKey,
} from 'solid-js/web';
import { CLIENT_PROPS, SERVER_PROPS } from '../shared/constants';
import {
  ClientComponent,
  ClientProps,
  SerializableProps,
  ServerComponent,
  ServerProps,
} from '../shared/types';

const REGISTRATION = new Map<string, ServerComponent<any>>();

export function $$server<P extends SerializableProps>(
  id: string,
  Comp: ServerComponent<P>,
): ServerComponent<ServerProps<P>> {
  function ServerComp(props: ServerProps<P>): JSX.Element {
    const [, rest] = splitProps(props, SERVER_PROPS);
    return createComponent(Comp, rest as unknown as P);
  }
  REGISTRATION.set(id, ServerComp);
  return ServerComp;
}

const ROOT = ['<isolid-frame', '><isolid-root>', '</isolid-root><template>', '</template><script type="module">', '</script></isolid-frame>'];
const FRAGMENT = ['<isolid-fragment', '>', '</isolid-fragment>'];

let SCOPE: AsyncServerValue[];

function runWithScope<T>(scope: AsyncServerValue[], callback: () => T): T {
  const parent = SCOPE;
  SCOPE = scope;
  try {
    return callback();
  } finally {
    SCOPE = parent;
  }
}

export function $$scope(): AsyncServerValue[] {
  return SCOPE!;
}

export function $$client<P extends SerializableProps>(
  id: string,
  Comp: ClientComponent<P>,
  lexicalScope: () => AsyncServerValue[],
): ClientComponent<ClientProps<P>> {
  return function ClientComp(props: ClientProps<P>): JSX.Element {
    const root = createUniqueId();
    const [local, rest] = splitProps(props, CLIENT_PROPS);

    let fragment: JSX.Element;

    const getRoot = () => {
      if (local['client:only']) {
        return () => '';
      }
      if ('children' in local) {
        const [result] = createResource(
          () => renderToStringAsync(() => (
            createComponent(Comp, mergeProps(local, {
              get children() {
                fragment = ssr(
                  FRAGMENT,
                  ssrHydrationKey(),
                  escape(local.children as string),
                ) as unknown as JSX.Element;
                return fragment;
              },
            }) as P)
          ), {
            renderId: root,
          }),
        );

        return result;
      }
      const [result] = createResource(
        () => renderToStringAsync(() => (
          runWithScope(lexicalScope(), () => createComponent(Comp, rest as P))
        ), {
          renderId: root,
        }),
      );

      return result;
    };

    const rootRender = getRoot();

    const [serializedProps] = createResource(() => serializeAsync(rest));

    const [, strategy] = splitProps(local, ['children']);
    const [strategyProps] = createResource(() => serializeAsync(strategy));
    const [serializedScope] = createResource(() => serializeAsync(lexicalScope()));

    return createComponent(Suspense, {
      get children() {
        return ssr(
          ROOT,
          ssrHydrationKey() + ssrAttribute('root-id', root as unknown as boolean),
          rootRender(),
          fragment,
          `import m from "/${id}.js";m("${root}",${String('children' in props)},${serializedProps() || ''},${strategyProps() || ''},${serializedScope() || ''});`,
        ) as unknown as JSX.Element;
      },
    });
  };
}
