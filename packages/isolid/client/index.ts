/* eslint-disable no-underscore-dangle */
import { toJSON } from 'seroval';
import type { JSX } from 'solid-js';
import {
  createComponent,
  createMemo,
  createResource,
  splitProps,
} from 'solid-js';
import { hydrate, render } from 'solid-js/web';
import assert from '../shared/assert';
import { CLIENT_PROPS, getServerComponentPath, SERVER_PROPS } from '../shared/constants';
import type {
  ClientComponent,
  ClientSpecialProps,
  ClientProps,
  SerializableProps,
  ServerComponent,
  ServerOptions,
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

function trackAll<P extends SerializableProps>(props: P): void {
  for (const key of Object.keys(props)) {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    props[key];
  }
}

export function $$server<P extends SerializableProps>(
  id: string,
  _Comp: ServerComponent<P>,
  scope: () => unknown[],
): ServerComponent<ServerProps<P>> {
  return function Comp(props: ServerProps<P>): JSX.Element {
    const [, rest] = splitProps(props, SERVER_PROPS);

    const [data] = createResource(
      () => {
        trackAll(rest);
        return [props['server:options'], rest] as const;
      },
      async ([options, restProps]) => {
        const response = await fetch(getServerComponentPath(id), {
          ...(options as ServerOptions),
          method: 'POST',
          body: JSON.stringify(toJSON({
            scope: scope(),
            props: restProps,
          })),
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
    }) as unknown as JSX.Element;
  };
}

export function $$client<P extends SerializableProps>(
  _id: string,
  Comp: ClientComponent<P>,
  scope: () => unknown[],
): ClientComponent<ClientProps<P>> {
  return function ClientComp(props: ClientProps<P>): JSX.Element {
    const [, rest] = splitProps(props, CLIENT_PROPS);
    return runWithScope(scope(), () => createComponent(Comp, rest as P));
  };
}

async function renderRoot(
  strategy: ClientSpecialProps,
  marker: Element,
  renderCallback: () => void,
): Promise<(() => void) | undefined> {
  if (strategy['client:load']) {
    const call = await import('isolid-scheduler/load');
    return call.default(renderCallback);
  }
  if (strategy['client:visible']) {
    const call = await import('isolid-scheduler/visible');
    return call.default(marker, renderCallback, true);
  }
  if (strategy['client:media'] != null) {
    const call = await import('isolid-scheduler/media');
    return call.default(strategy['client:media'], renderCallback);
  }
  if (strategy['client:idle']) {
    const call = await import('isolid-scheduler/idle');
    return call.default(renderCallback);
  }
  if (strategy['client:animation-frame']) {
    const call = await import('isolid-scheduler/animation-frame');
    return call.default(renderCallback);
  }
  if (strategy['client:delay'] != null) {
    const call = await import('isolid-scheduler/delay');
    return call.default(strategy['client:delay'], renderCallback);
  }
  if (strategy['client:interaction']) {
    const call = await import('isolid-scheduler/interaction');
    return call.default(strategy['client:interaction'], marker, renderCallback);
  }
  if (strategy['client:ready-state']) {
    const call = await import('isolid-scheduler/ready-state');
    return call.default(strategy['client:ready-state'], renderCallback);
  }
  return undefined;
}

type Island<P extends SerializableProps> = (
  id: string,
  props: P,
  strategy: ClientSpecialProps,
  scope: unknown[],
) => Promise<void>;

interface WindowWithIsolid {
  __ISOLID__: Record<string, Island<any>>;
}

declare let window: typeof Window & WindowWithIsolid;

function getRoot(id: string): Element {
  const marker = document.querySelector(`isolid-frame[root-id="${id}"] > isolid-root`);
  if (marker) {
    return marker;
  }
  throw new Error(`Missing isolid-frame[root-id="${id}"] > isolid-root`);
}

export function $$island<P extends SerializableProps>(
  hash: string,
  source: () => Promise<{ default: ClientComponent<P> }>,
): void {
  const island: Island<P> = async (id, props, strategy, scope) => {
    const marker = getRoot(id);
    const Comp = (await source()).default;

    await renderRoot(strategy, marker, () => {
      const root = (): JSX.Element => runWithScope(scope, () => createComponent(Comp, props));

      if (strategy['client:only']) {
        render(root, marker);
      } else {
        hydrate(root, marker, {
          renderId: id,
        });
      }
    });
  };

  window.__ISOLID__ = window.__ISOLID__ || {};
  window.__ISOLID__[hash] = island;
}
