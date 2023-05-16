import type { ClientSpecialProps, ServerSpecialProps } from './types';

export const SERVER_PROPS: (keyof ServerSpecialProps)[] = [
  'server:options',
];

export const CLIENT_PROPS: (keyof ClientSpecialProps)[] = [
  'client:animation-frame',
  'client:delay',
  'client:idle',
  'client:interaction',
  'client:load',
  'client:media',
  'client:only',
  'client:ready-state',
  'client:visible',
];

export function getServerComponentPath(id: string): string {
  return `/__isolid/server/${id}`;
}
