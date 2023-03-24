/* eslint-disable @typescript-eslint/no-use-before-define */
import * as babel from '@babel/core';
import * as t from '@babel/types';
import { parse, join } from 'path';
import { GeneratorResult } from '@babel/generator';
import { getImportSpecifierName } from './checks';
import unwrapNode from './unwrap-node';
import xxHash32 from './xxhash32';
import generator from './generator-shim';
import transformClientComponent from './transform-client-component';
import { CompilerOptions, StateContext } from './types';

const SERVER_COMPONENT = 'serverComponent$';
const CLIENT_COMPONENT = 'clientComponent$';

export interface CompilerOutput extends GeneratorResult {
  files: Map<string, string>;
  clients: Map<string, string>;
}

export default async function compile(
  id: string,
  code: string,
  options: CompilerOptions,
): Promise<CompilerOutput> {
  const parsedPath = parse(id);
  const ctx: StateContext = {
    basename: parsedPath.base,
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
  };

  const plugins: babel.ParserOptions['plugins'] = ['jsx'];

  if (/\.[mc]?tsx?$/i.test(id)) {
    plugins.push('typescript');
  }

  const ast = await babel.parseAsync(code, {
    parserOpts: {
      plugins,
    },
  });

  if (!ast) {
    throw new Error('invariant');
  }

  // Collect all import identifiers
  const serverIdentifiers = new Set<t.Identifier>();
  const clientIdentifiers = new Set<t.Identifier>();
  babel.traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value === 'isolid') {
        for (let i = 0, len = path.node.specifiers.length; i < len; i++) {
          const specifier = path.node.specifiers[i];

          switch (specifier.type) {
            case 'ImportSpecifier':
              switch (getImportSpecifierName(specifier)) {
                case SERVER_COMPONENT:
                  serverIdentifiers.add(specifier.local);
                  break;
                case CLIENT_COMPONENT:
                  clientIdentifiers.add(specifier.local);
                  break;
                default:
                  break;
              }
              break;
            default:
              break;
          }
        }
      }
    },
  });

  // Transform call expressions
  babel.traverse(ast, {
    CallExpression(path) {
      const identifier = unwrapNode(path.node.callee, t.isIdentifier);
      if (identifier) {
        const binding = path.scope.getBindingIdentifier(identifier.name);
        if (binding) {
          if (serverIdentifiers.has(binding)) {
            // do serverComponent$ transformation
          }
          if (clientIdentifiers.has(binding)) {
            transformClientComponent(ctx, path);
          }
        }
      }
    },
  });

  babel.traverse(ast, {
    Program(path) {
      for (const key of ctx.bindings.keys()) {
        const binding = path.scope.getBinding(key);
        if (binding) {
          binding.path.remove();
        }
      }
    },
  });

  const files = new Map<string, string>();
  const clients = new Map<string, string>();

  for (const [key, value] of ctx.virtual.files) {
    files.set(join(parsedPath.dir, key), value);
  }
  for (const [key, value] of ctx.clients.targets) {
    clients.set(key, join(parsedPath.dir, value));
  }

  return {
    ...generator(ast),
    files,
    clients,
  };
}
