import { AsyncServerValue, serializeAsync } from 'seroval';
import {
  createComponent,
  createMemo,
  createResource,
  JSX,
  mergeProps,
  splitProps,
} from 'solid-js';
import { hydrate, render } from 'solid-js/web';
import { CLIENT_PROPS, SERVER_PROPS } from '../shared/constants';
import {
  ClientComponent,
  ClientHydrationStrategy,
  ClientProps,
  SerializableProps,
  ServerComponent,
  ServerOptions,
  ServerProps,
} from '../shared/types';
import { getFragment, getRoot } from './nodes';
import processScript from './process-script';

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

function trackAll<P extends SerializableProps>(props: P) {
  for (const key of Object.keys(props)) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises, no-unused-expressions
    props[key];
  }
}

export function $$server<P extends SerializableProps>(
  id: string,
): ServerComponent<ServerProps<P>> {
  return function Comp(props: ServerProps<P>): JSX.Element {
    const [, rest] = splitProps(props, SERVER_PROPS);

    const [data] = createResource(
      () => {
        trackAll(rest);
        return [props['server:options'], rest] as const;
      },
      async ([options, restProps]) => {
        const response = await fetch(id, {
          ...(options as ServerOptions),
          method: 'POST',
          body: await serializeAsync(restProps),
        });
        if (response.ok) {
          const content = await response.text();
          return content;
        }
        throw new Error('Unexpected error');
      },
    );

    const template = document.createElement('template');

    return createMemo(() => {
      const result = data();
      if (result) {
        template.innerHTML = result;

        const children: JSX.Element[] = [];

        let child = template.content.firstChild;

        while (child) {
          children.push(child);
          child = child.nextSibling;
        }

        return children;
      }
      return undefined;
    });
  };
}

export function $$client<P extends SerializableProps>(
  id: string,
  OriginalComp: ClientComponent<P>,
  lexicalScope: () => AsyncServerValue[],
): ClientComponent<ClientProps<P>> {
  return function Comp(props: ClientProps<P>): JSX.Element {
    const [, rest] = splitProps(props, CLIENT_PROPS);
    return runWithScope(lexicalScope(), () => createComponent(OriginalComp, rest as P));
  };
}

async function renderRoot(
  strategy: ClientHydrationStrategy,
  marker: Element,
  renderCallback: () => void,
): Promise<(() => void) | undefined> {
  if (strategy['client:load']) {
    const call = await import('isolid/scheduler/load') as typeof import('../scheduler/on-load');
    return call.default(renderCallback);
  }
  if (strategy['client:visible']) {
    const call = await import('isolid/scheduler/visible') as typeof import('../scheduler/on-visible');
    return call.default(marker, renderCallback, true);
  }
  if (strategy['client:media'] != null) {
    const call = await import('isolid/scheduler/media') as typeof import('../scheduler/on-media');
    return call.default(strategy['client:media'], renderCallback);
  }
  if (strategy['client:idle']) {
    const call = await import('isolid/scheduler/idle') as typeof import('../scheduler/on-idle');
    return call.default(renderCallback);
  }
  if (strategy['client:animation-frame']) {
    const call = await import('isolid/scheduler/animation-frame') as typeof import('../scheduler/on-animation-frame');
    return call.default(renderCallback);
  }
  if (strategy['client:delay'] != null) {
    const call = await import('isolid/scheduler/delay') as typeof import('../scheduler/on-delay');
    return call.default(strategy['client:delay'], renderCallback);
  }
  if (strategy['client:interaction']) {
    const call = await import('isolid/scheduler/interaction') as typeof import('../scheduler/on-interaction');
    return call.default(strategy['client:interaction'], marker, renderCallback);
  }
  if (strategy['client:ready-state']) {
    const call = await import('isolid/scheduler/ready-state') as typeof import('../scheduler/on-ready-state');
    return call.default(strategy['client:ready-state'], renderCallback);
  }
  return undefined;
}

type Island<P extends SerializableProps> = (
  id: string,
  hasChildren: boolean,
  props: P,
  strategy: ClientHydrationStrategy,
  scope: AsyncServerValue[],
) => Promise<void>;

export function $$island<P extends SerializableProps>(
  source: () => Promise<{ default: ClientComponent<P>}>,
): Island<P> {
  return async (id, hasChildren, props, strategy, scope) => {
    const marker = getRoot(id);
    const Comp = (await source()).default;

    await renderRoot(strategy, marker, () => {
      const root = () => {
        if (hasChildren) {
          const fragment = getFragment(id);
          return runWithScope(scope, () => (
            createComponent(Comp, mergeProps(props, {
              get children() {
                if (fragment) {
                  const node = fragment.content.firstChild;
                  if (node) {
                    processScript(node);
                    return node;
                  }
                }
                return null;
              },
            }) as P & { children?: JSX.Element })
          ));
        }
        return runWithScope(scope, () => createComponent(Comp, props));
      };

      if (strategy['client:only']) {
        render(root, marker);
      } else {
        hydrate(root, marker, {
          renderId: id,
        });
      }
    });
  };
}
