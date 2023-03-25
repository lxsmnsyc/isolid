/* eslint-disable @typescript-eslint/no-use-before-define */
import * as babel from '@babel/core';
import * as t from '@babel/types';
import { parse, join } from 'path';
import { GeneratorResult } from '@babel/generator';
import { getImportSpecifierName } from './checks';
import unwrapNode from './unwrap-node';
import xxHash32 from './xxhash32';
import transformClientComponent from './transform-client-component';
import { CompilerOptions, StateContext } from './types';

const SERVER_COMPONENT = 'serverComponent$';
const CLIENT_COMPONENT = 'clientComponent$';

export interface CompilerOutput extends GeneratorResult {
  files: Map<string, string>;
  clients: Map<string, string>;
}

interface State extends babel.PluginPass {
  opts: StateContext;
}

function plugin(): babel.PluginObj<State> {
  return {
    name: 'isolid',
    visitor: {
      Program: {
        enter(program, pass) {
          program.traverse({
            ImportDeclaration(path) {
              if (path.node.source.value === 'isolid') {
                for (let i = 0, len = path.node.specifiers.length; i < len; i++) {
                  const specifier = path.node.specifiers[i];

                  switch (specifier.type) {
                    case 'ImportSpecifier':
                      switch (getImportSpecifierName(specifier)) {
                        case SERVER_COMPONENT:
                          pass.opts.identifiers.server.add(specifier.local);
                          break;
                        case CLIENT_COMPONENT:
                          pass.opts.identifiers.client.add(specifier.local);
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
        },
      },
      CallExpression(path, pass) {
        const identifier = unwrapNode(path.node.callee, t.isIdentifier);
        if (identifier) {
          const binding = path.scope.getBindingIdentifier(identifier.name);
          if (binding) {
            if (pass.opts.identifiers.server.has(binding)) {
              // do serverComponent$ transformation
            }
            if (pass.opts.identifiers.client.has(binding)) {
              transformClientComponent(pass.opts, path);
            }
          }
        }
      },
    },
  };
}

export default async function compile(
  id: string,
  code: string,
  options: CompilerOptions,
): Promise<CompilerOutput> {
  const parsedPath = parse(id);
  const ctx: StateContext = {
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

  if (!result) {
    throw new Error('invariant');
  }

  const files = new Map<string, string>();
  const clients = new Map<string, string>();

  for (const [key, value] of ctx.virtual.files) {
    files.set(join(parsedPath.dir, key), value);
  }
  for (const [key, value] of ctx.clients.targets) {
    clients.set(key, join(parsedPath.dir, value));
  }

  return {
    code: result.code || '',
    map: result.map || null,
    files,
    clients,
  };
}
