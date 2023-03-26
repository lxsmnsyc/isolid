import * as babel from '@babel/core';
import * as t from '@babel/types';
import { parse, join } from 'path';
import unwrapNode from './unwrap-node';
import xxHash32 from './xxhash32';
import { CompilerOptions, SplitStateContext } from './types';
import transformComponent from './transform-component';
import collectImportIdentifiers from './collect-import-identifiers';
import assert from '../shared/assert';
import getIslandCode from './get-island-code';

export interface SplitManifest {
  files: Map<string, string>;
  clients: Map<string, string>;
}

export interface SplitOutput extends babel.BabelFileResult, SplitManifest {
}

interface State extends babel.PluginPass {
  opts: SplitStateContext;
}

function plugin(): babel.PluginObj<State> {
  return {
    name: 'isolid/split',
    visitor: {
      Program: {
        enter(program, pass) {
          collectImportIdentifiers(pass.opts, program);
        },
      },
      CallExpression(path, pass) {
        const identifier = unwrapNode(path.node.callee, t.isIdentifier);
        if (identifier) {
          const binding = path.scope.getBindingIdentifier(identifier.name);
          if (binding) {
            if (pass.opts.identifiers.server.has(binding)) {
              transformComponent(pass.opts, path, true);
            }
            if (pass.opts.identifiers.client.has(binding)) {
              transformComponent(pass.opts, path, false);
            }
          }
        }
      },
    },
  };
}

export default async function split(
  id: string,
  code: string,
  options: CompilerOptions,
): Promise<SplitOutput> {
  const parsedPath = parse(id);
  const ctx: SplitStateContext = {
    path: parsedPath,
    virtual: {
      files: new Map(),
      id: 0,
    },
    bindings: new Map(),
    options,
    imports: new Map(),
    clients: {
      targets: new Map(),
      id: 0,
    },
    hash: xxHash32(id).toString(16),
    identifiers: {
      server: new Set(),
      client: new Set(),
      scope: new Set(),
    },
  };

  const plugins: babel.ParserOptions['plugins'] = ['jsx'];

  if (/\.[mc]?tsx?$/i.test(id)) {
    plugins.push('typescript');
  }

  const result = await babel.transformAsync(code, {
    plugins: [
      [plugin, ctx],
    ],
    parserOpts: {
      plugins,
    },
    filename: parsedPath.base,
    ast: false,
    sourceFileName: id,
    sourceMaps: true,
    configFile: false,
    babelrc: false,
  });

  assert(result, 'invariant');

  const files = new Map<string, string>();
  const clients = new Map<string, string>();

  for (const [key, value] of ctx.virtual.files) {
    files.set(join(parsedPath.dir, key), value);
  }
  for (const [key, value] of ctx.clients.targets) {
    clients.set(key, getIslandCode(key, join(parsedPath.dir, value)));
  }

  return {
    code: result.code,
    map: result.map,
    files,
    clients,
  };
}
