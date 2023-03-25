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
import assert from '../shared/assert';
import { CLIENT_PROPS, getServerComponentPath, SERVER_PROPS } from '../shared/constants';
import {
  ClientComponent,
  ClientProps,
  SerializableProps,
  ServerComponent,
  ServerProps,
} from '../shared/types';

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
  assert(SCOPE, 'Unexpected use of $$scope');
  return SCOPE;
}

const REGISTRATION = new Map<string, ServerComponent<any>>();

export function $$server<P extends SerializableProps>(
  id: string,
  Comp: ClientComponent<P>,
  scope: () => AsyncServerValue[],
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
  scope: () => AsyncServerValue[],
): ClientComponent<ClientProps<P>> {
  return function ClientComp(props: ClientProps<P>): JSX.Element {
    const root = createUniqueId();
    const [local, rest] = splitProps(props, CLIENT_PROPS);

    let fragment: JSX.Element;

    const getRoot = () => {
      if (local['client:only']) {
        return () => '';
      }
      if ('children' in rest) {
        const [result] = createResource(
          () => renderToStringAsync(() => (
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
          }),
        );

        return result;
      }
      const [result] = createResource(
        () => renderToStringAsync(() => (
          runWithScope(
            scope(),
            () => createComponent(Comp, rest as P),
          )
        ), {
          renderId: root,
        }),
      );

      return result;
    };

    const rootRender = getRoot();

    const [serializedProps] = createResource(() => serializeAsync(rest));
    const [strategyProps] = createResource(() => serializeAsync(local));
    const [serializedScope] = createResource(() => serializeAsync(scope()));

    return createComponent(Suspense, {
      get children() {
        return ssr(
          ROOT,
          ssrHydrationKey() + ssrAttribute('root-id', root as unknown as boolean),
          rootRender(),
          fragment,
          `import m from "/__isolid/${id}.js";m("${root}",${String('children' in props)},${serializedProps() || ''},${strategyProps() || ''},${serializedScope() || ''});`,
        ) as unknown as JSX.Element;
      },
    });
  };
}
