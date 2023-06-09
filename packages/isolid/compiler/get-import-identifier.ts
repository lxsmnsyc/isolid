import * as babel from '@babel/core';
import { addNamed } from '@babel/helper-module-imports';
import { CompileStateContext } from './types';

export default function getImportIdentifier(
  ctx: CompileStateContext,
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
