import { AsyncServerValue } from 'seroval';
import { JSX } from 'solid-js';

export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {};

export type SerializableProps = Record<string, AsyncServerValue>;

type OmitAndMerge<L, R> = Prettify<Omit<L, keyof R> & R>;

export type ServerOptions = Omit<RequestInit, 'method' | 'body'>;

export type ServerSpecialProps = {
  'server:options': ServerOptions;
};

export type ServerProps<P> = OmitAndMerge<P, ServerSpecialProps>;

export type ServerComponent<P> =
  (props: P & { children?: JSX.Element }) => JSX.Element;

export interface ClientSpecialProps {
  'client:load'?: boolean;
  'client:visible'?: boolean;
  'client:media'?: string;
  'client:only'?: boolean;
  'client:idle'?: boolean;
  'client:animation-frame'?: boolean;
  'client:delay'?: number;
  'client:interaction'?: string[] | boolean;
  'client:ready-state'?: DocumentReadyState;
}

export type ClientProps<P> = OmitAndMerge<P, ClientSpecialProps>;

export type ClientComponent<P> =
  (props: P & { children?: JSX.Element }) => JSX.Element;

export interface ServerComponentData<P> {
  scope: AsyncServerValue[];
  props: P;
}
