import {
  ClientComponent,
  ClientProps,
  SerializableProps,
  ServerComponent,
  ServerProps,
} from '../shared/types';

export function serverComponent$<P extends SerializableProps>(
  Comp: ServerComponent<P>,
): ServerComponent<ServerProps<P>> {
  return Comp as unknown as ServerComponent<ServerProps<P>>;
}

export function clientComponent$<P extends SerializableProps>(
  Comp: ClientComponent<P>,
): ClientComponent<ClientProps<P>> {
  return Comp as unknown as ClientComponent<ClientProps<P>>;
}

export function $$server<P extends SerializableProps>(
  Comp: ServerComponent<P>,
): ServerComponent<ServerProps<P>> {
  return Comp as unknown as ServerComponent<ServerProps<P>>;
}

export function $$client<P extends SerializableProps>(
  Comp: ClientComponent<P>,
): ClientComponent<ClientProps<P>> {
  return Comp as unknown as ClientComponent<ClientProps<P>>;
}
