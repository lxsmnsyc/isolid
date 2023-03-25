import * as babel from '@babel/core';
import * as t from '@babel/types';
import { parse } from 'path';
import unwrapNode from './unwrap-node';
import { CompilerOptions, CompileStateContext } from './types';
import collectImportIdentifiers from './collect-import-identifiers';
import getImportIdentifier from './get-import-identifier';
import {
  HIDDEN_CLIENT_COMPONENT,
  HIDDEN_SERVER_COMPONENT,
  HIDDEN_USE_SCOPE,
} from './constants';
import assert from '../shared/assert';

export type CompilerOutput = babel.BabelFileResult;

interface State extends babel.PluginPass {
  opts: CompileStateContext;
}

function plugin(): babel.PluginObj<State> {
  return {
    name: 'isolid/compile',
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
              path.node.callee = getImportIdentifier(
                pass.opts,
                path,
                `isolid/${pass.opts.options.mode}`,
                HIDDEN_SERVER_COMPONENT,
              );
            }
            if (pass.opts.identifiers.client.has(binding)) {
              path.node.callee = getImportIdentifier(
                pass.opts,
                path,
                `isolid/${pass.opts.options.mode}`,
                HIDDEN_CLIENT_COMPONENT,
              );
            }
            if (pass.opts.identifiers.scope.has(binding)) {
              path.node.callee = getImportIdentifier(
                pass.opts,
                path,
                `isolid/${pass.opts.options.mode}`,
                HIDDEN_USE_SCOPE,
              );
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
  const ctx: CompileStateContext = {
    options,
    imports: new Map(),
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

  return {
    code: result.code,
    map: result.map,
  };
}
