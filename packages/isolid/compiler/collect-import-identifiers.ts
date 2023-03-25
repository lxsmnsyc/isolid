import * as babel from '@babel/core';
import * as t from '@babel/types';
import { getImportSpecifierName } from './checks';
import {
  SERVER_COMPONENT,
  CLIENT_COMPONENT,
  HIDDEN_SERVER_COMPONENT,
  HIDDEN_CLIENT_COMPONENT,
} from './constants';
import { CompileStateContext } from './types';

export default function collectImportIdentifiers(
  ctx: CompileStateContext,
  program: babel.NodePath<t.Program>,
) {
  program.traverse({
    ImportDeclaration(path) {
      if (path.node.source.value === 'isolid') {
        for (let i = 0, len = path.node.specifiers.length; i < len; i++) {
          const specifier = path.node.specifiers[i];

          switch (specifier.type) {
            case 'ImportSpecifier':
              switch (getImportSpecifierName(specifier)) {
                case SERVER_COMPONENT:
                case HIDDEN_SERVER_COMPONENT:
                  ctx.identifiers.server.add(specifier.local);
                  break;
                case CLIENT_COMPONENT:
                case HIDDEN_CLIENT_COMPONENT:
                  ctx.identifiers.client.add(specifier.local);
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
}
