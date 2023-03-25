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

export interface StateContext {
  path: ParsedPath;
  virtual: {
    files: Map<string, string>;
    id: number;
  };
  bindings: Map<string, ModuleDefinition>;
  options: CompilerOptions;
  imports: Map<string, t.Identifier>;
  clients: {
    targets: Map<string, string>;
    id: number;
  };
  hash: string;
  identifiers: {
    server: Set<t.Identifier>;
    client: Set<t.Identifier>;
  };
}
