import * as t from '@babel/types';
import { ParsedPath } from 'path';

export type ModuleDefinitionKind = 'named' | 'namespace' | 'default';

export interface ModuleDefinition {
  source: string;
  kind: ModuleDefinitionKind;
  local: string;
  imported?: string;
}

export interface CompilerOptions {
  mode: 'server' | 'client';
}

export interface CompileStateContext {
  options: CompilerOptions;
  imports: Map<string, t.Identifier>;
  identifiers: {
    server: Set<t.Identifier>;
    client: Set<t.Identifier>;
  };
}

export interface SplitStateContext extends CompileStateContext {
  path: ParsedPath;
  virtual: {
    files: Map<string, string>;
    id: number;
  };
  bindings: Map<string, ModuleDefinition>;
  clients: {
    targets: Map<string, string>;
    id: number;
  };
  hash: string;
}
