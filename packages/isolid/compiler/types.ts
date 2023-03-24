import * as t from '@babel/types';

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
  basename: string;
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
}
