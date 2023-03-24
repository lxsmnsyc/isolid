import * as babel from '@babel/core';
import { addNamed } from '@babel/helper-module-imports';
import { StateContext } from './types';

export default function getImportIdentifier(
  ctx: StateContext,
  path: babel.NodePath,
  source: string,
  name: string,
) {
  const target = `${source}[${name}]`;
  const current = ctx.imports.get(target);
  if (current) {
    return current;
  }
  const newID = addNamed(path, name, source);
  ctx.imports.set(target, newID);
  return newID;
}
