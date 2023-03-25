import { AsyncServerValue } from 'seroval';
import { JSX } from 'solid-js';

export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {};

export type SerializableProps = {
  [key: Exclude<string, 'children'>]: AsyncServerValue;
};

type OmitAndMerge<L, R> = Prettify<Omit<L, keyof R> & R>;

export type ServerOptions = Omit<RequestInit, 'method' | 'body'>;

export type ServerSpecialProps = {
  'server:options': ServerOptions;
};

export type ServerProps<P extends SerializableProps> = OmitAndMerge<P, ServerSpecialProps>;

export type ServerComponent<P extends SerializableProps> =
  (props: P) => JSX.Element;

export interface ClientHydrationStrategy {
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

export interface ClientSpecialProps extends ClientHydrationStrategy {
  children?: JSX.Element;
}

export type ClientProps<P extends SerializableProps> = OmitAndMerge<P, ClientSpecialProps>;

export type ClientComponent<P extends SerializableProps> =
  (props: P) => JSX.Element;
