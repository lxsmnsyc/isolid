import { AsyncServerValue, serializeAsync } from 'seroval';
import {
  createComponent,
  createMemo,
  createResource,
  JSX,
  splitProps,
} from 'solid-js';
import { CLIENT_PROPS, SERVER_PROPS } from '../shared/constants';
import {
  ClientComponent,
  ClientProps,
  SerializableProps,
  ServerComponent,
  ServerOptions,
  ServerProps,
} from '../shared/types';

let SCOPE: AsyncServerValue[];

function runWithScope<T>(scope: () => AsyncServerValue[], callback: () => T): T {
  const parent = SCOPE;
  SCOPE = scope();
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
): ClientComponent<ClientProps<P>> {
  return function Comp(props: ClientProps<P>): JSX.Element {
    const [, rest] = splitProps(props, CLIENT_PROPS);

    createMemo(() => id, {
      name: id,
    });

    return createComponent(OriginalComp, rest as P);
  };
}
