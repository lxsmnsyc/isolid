import assert from '../shared/assert';
import {
  ClientComponent,
  ClientProps,
  SerializableProps,
  ServerComponent,
  ServerProps,
} from '../shared/types';

export {
  SerializableProps,
  ServerComponent,
  ServerProps,
  ClientComponent,
  ClientProps,
};

export function serverComponent$<P>(
  Comp: ServerComponent<P>,
): ServerComponent<ServerProps<P>> {
  assert(false, 'Unexpected use of serverComponent$');
  return Comp as unknown as ServerComponent<ServerProps<P>>;
}

export function clientComponent$<P>(
  Comp: ClientComponent<P>,
): ClientComponent<ClientProps<P>> {
  assert(false, 'Unexpected use of clientComponent$');
  return Comp as unknown as ClientComponent<ClientProps<P>>;
}

export function $$server(): unknown {
  assert(false, 'Unexpected use of $$server');
}

export function $$client(): unknown {
  assert(false, 'Unexpected use of $$client');
}

export function $$scope(): unknown {
  assert(false, 'Unexpected use of $$scope');
}
