import { AsyncServerValue } from 'seroval';

let SCOPE: AsyncServerValue[];

export interface ScopedCallback<T extends any[], R> {
  id: string;
  call: (...args: T) => R;
  scope: () => AsyncServerValue[];
}

export function createScope<T extends any[], R>(
  id: string,
  call: (...args: T) => R,
  scope: () => AsyncServerValue[],
): ScopedCallback<T, R> {
  return {
    id,
    call,
    scope,
  };
}

export function runWithScope<T>(scope: AsyncServerValue[], callback: () => T): T {
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
