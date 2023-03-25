/* eslint-disable @typescript-eslint/no-use-before-define */
import * as t from '@babel/types';
import { getImportSpecifierName, isPathValid } from './checks';
import getForeignBindings, { getNormalBindings } from './get-foreign-bindings';
import { ModuleDefinition, SplitStateContext } from './types';
import generator from './generator-shim';
import getImportIdentifier from './get-import-identifier';
import {
  HIDDEN_CLIENT_COMPONENT,
  HIDDEN_SERVER_COMPONENT,
  HIDDEN_USE_SCOPE,
} from './constants';
import assert from '../shared/assert';

function getModuleDefinition(
  path: babel.NodePath,
): ModuleDefinition {
  assert(
    isPathValid(path, t.isImportSpecifier)
    || isPathValid(path, t.isImportDefaultSpecifier)
    || isPathValid(path, t.isImportNamespaceSpecifier),
    'invariant',
  );
  const parent = path.getStatementParent() as babel.NodePath<t.ImportDeclaration>;
  const source = parent.node.source.value;
  switch (path.node.type) {
    case 'ImportDefaultSpecifier':
      return {
        source,
        kind: 'default',
        local: path.node.local.name,
      };
    case 'ImportNamespaceSpecifier':
      return {
        source,
        kind: 'namespace',
        local: path.node.local.name,
      };
    case 'ImportSpecifier': {
      const imported = getImportSpecifierName(path.node);
      if (imported === 'default') {
        return {
          source,
          kind: 'default',
          local: path.node.local.name,
          imported: '',
        };
      }
      return {
        source,
        kind: 'named',
        local: path.node.local.name,
        imported,
      };
    }
    default: throw new Error('invariant');
  }
}

function moduleDefinitionToImportSpecifier(definition: ModuleDefinition) {
  switch (definition.kind) {
    case 'default':
      return t.importDefaultSpecifier(t.identifier(definition.local));
    case 'named':
      return t.importSpecifier(
        t.identifier(definition.local),
        definition.imported
          ? t.stringLiteral(definition.imported)
          : t.identifier(definition.local),
      );
    case 'namespace':
      return t.importNamespaceSpecifier(t.identifier(definition.local));
    default:
      throw new Error('invariant');
  }
}

function moduleDefinitionToImportDeclaration(
  definition: ModuleDefinition,
) {
  return t.importDeclaration(
    [moduleDefinitionToImportSpecifier(definition)],
    t.stringLiteral(definition.source),
  );
}

function moduleDefinitionsToImportDeclarations(
  definitions: ModuleDefinition[],
) {
  const declarations: t.ImportDeclaration[] = [];
  for (let i = 0, len = definitions.length; i < len; i++) {
    declarations[i] = moduleDefinitionToImportDeclaration(definitions[i]);
  }
  return declarations;
}

function getRootStatementPath(path: babel.NodePath) {
  let current = path.parentPath;
  while (current) {
    const next = current.parentPath;
    if (t.isProgram(next)) {
      return current;
    }
    current = next;
  }
  return path;
}

function getIdentifiersFromLVal(node: t.LVal): string[] {
  switch (node.type) {
    case 'Identifier':
      return [node.name];
    case 'ArrayPattern': {
      const ids: string[] = [];
      for (let i = 0, len = node.elements.length; i < len; i++) {
        const el = node.elements[i];
        if (el) {
          ids.push(...getIdentifiersFromLVal(el));
        }
      }
      return ids;
    }
    case 'AssignmentPattern':
      return getIdentifiersFromLVal(node.left);
    case 'ObjectPattern': {
      const ids: string[] = [];
      for (let i = 0, len = node.properties.length; i < len; i++) {
        const el = node.properties[i];
        if (el) {
          if (el.type === 'RestElement') {
            ids.push(...getIdentifiersFromLVal(el));
          } else if (t.isLVal(el.value)) {
            ids.push(...getIdentifiersFromLVal(el.value));
          }
        }
      }
      return ids;
    }
    case 'RestElement':
      return getIdentifiersFromLVal(node.argument);
    default:
      return [];
  }
}

function createVirtualFileName(
  ctx: SplitStateContext,
) {
  return `./${ctx.path.base}?isolid=${ctx.virtual.id++}${ctx.path.ext}`;
}

function splitFunctionDeclaration(
  ctx: SplitStateContext,
  path: babel.NodePath<t.FunctionDeclaration>,
): ModuleDefinition {
  // Collect referenced identifiers
  const bindings = getForeignBindings(path);
  // Map to actual bindings
  const moduleBindings: ModuleDefinition[] = [];
  const localBindings: t.Identifier[] = [];
  for (let i = 0, len = bindings.length; i < len; i++) {
    const binding = bindings[i];
    const result = path.scope.getBinding(binding.name);
    if (result) {
      switch (result.kind) {
        case 'module':
          moduleBindings.push(getModuleDefinition(result.path));
          break;
        case 'const':
        case 'let':
        case 'var':
        case 'hoisted': {
          const blockParent = result.path.scope.getBlockParent();
          const programParent = result.path.scope.getProgramParent();

          if (blockParent === programParent) {
            const current = ctx.bindings.get(binding.name);
            if (current) {
              moduleBindings.push(current);
            } else if (isPathValid(result.path, t.isVariableDeclarator)) {
              const definitions = splitVariableDeclarator(ctx, result.path);
              // Push definition
              moduleBindings.push(...definitions);
              // Dedupe
              for (let k = 0, klen = definitions.length; k < klen; k++) {
                ctx.bindings.set(definitions[k].local, definitions[k]);
              }
            } else if (isPathValid(result.path, t.isFunctionDeclaration)) {
              const definition = splitFunctionDeclaration(ctx, result.path);
              moduleBindings.push(definition);
              // Dedupe
              ctx.bindings.set(definition.local, definition);
            }
          } else {
            localBindings.push(binding);
          }
        }
          break;
        case 'param':
          localBindings.push(bindings[i]);
          break;
        default:
          break;
      }
    }
  }

  const moduleDeclarations = moduleDefinitionsToImportDeclarations(moduleBindings);

  const file = createVirtualFileName(ctx);
  const compiled = generator(
    t.program([
      ...moduleDeclarations,
      t.exportDefaultDeclaration(path.node),
    ]),
  );
  ctx.virtual.files.set(file, compiled.code);

  const identifier = path.node.id || path.scope.generateUidIdentifier('fn');

  const definition: ModuleDefinition = {
    kind: 'default',
    local: identifier.name,
    source: file,
  };
  const statement = path.getStatementParent();
  if (statement) {
    statement.insertBefore(
      moduleDefinitionToImportDeclaration(definition),
    );
  }
  path.remove();

  return definition;
}

function splitVariableDeclarator(
  ctx: SplitStateContext,
  path: babel.NodePath<t.VariableDeclarator>,
): ModuleDefinition[] {
  // Collect referenced identifiers
  const init = path.get('init');
  const bindings = (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init))
    ? getForeignBindings(init as babel.NodePath)
    : getNormalBindings(path);

  // Map to actual bindings
  const moduleBindings: ModuleDefinition[] = [];
  for (let i = 0, len = bindings.length; i < len; i++) {
    const binding = bindings[i];
    const result = path.scope.getBinding(binding.name);
    if (result) {
      switch (result.kind) {
        case 'module':
          moduleBindings.push(getModuleDefinition(result.path));
          break;
        case 'const':
        case 'let':
        case 'var':
        case 'hoisted': {
          const blockParent = result.path.scope.getBlockParent();
          const programParent = result.path.scope.getProgramParent();

          if (blockParent === programParent) {
            const current = ctx.bindings.get(binding.name);
            if (current) {
              moduleBindings.push(current);
            } else if (isPathValid(result.path, t.isVariableDeclarator)) {
              const definitions = splitVariableDeclarator(ctx, result.path);
              // Push definition
              moduleBindings.push(...definitions);
              // Dedupe
              for (let k = 0, klen = definitions.length; k < klen; k++) {
                ctx.bindings.set(definitions[k].local, definitions[k]);
              }
            } else if (isPathValid(result.path, t.isFunctionDeclaration)) {
              const definition = splitFunctionDeclaration(ctx, result.path);
              moduleBindings.push(definition);
              // Dedupe
              ctx.bindings.set(definition.local, definition);
            }
          }
        }
          break;
        case 'param':
          break;
        case 'unknown':
          break;
        default:
          break;
      }
    }
  }

  const moduleDeclarations = moduleDefinitionsToImportDeclarations(moduleBindings);

  const parent = path.parentPath.node as t.VariableDeclaration;
  const file = createVirtualFileName(ctx);
  const compiled = generator(
    t.program([
      ...moduleDeclarations,
      t.exportNamedDeclaration(
        t.variableDeclaration(
          parent.kind,
          [path.node],
        ),
      ),
    ]),
  );
  ctx.virtual.files.set(file, compiled.code);
  const definitions: ModuleDefinition[] = getIdentifiersFromLVal(path.node.id).map((name) => ({
    kind: 'named',
    local: name,
    source: file,
  }));
  // Replace declaration with definition
  const statement = path.getStatementParent();
  if (statement) {
    statement.insertBefore(
      moduleDefinitionsToImportDeclarations(definitions),
    );
  }
  path.remove();
  return definitions;
}

function splitComponent(
  ctx: SplitStateContext,
  path: babel.NodePath<t.FunctionExpression | t.ArrowFunctionExpression>,
): { definition: ModuleDefinition, locals: t.Identifier[] } {
  // Collect referenced identifiers
  const bindings = getForeignBindings(path);
  // Map to actual bindings
  const moduleBindings: ModuleDefinition[] = [];
  const localBindings: t.Identifier[] = [];
  for (let i = 0, len = bindings.length; i < len; i++) {
    const binding = bindings[i];
    const result = path.scope.getBinding(binding.name);
    if (result) {
      switch (result.kind) {
        case 'module':
          moduleBindings.push(getModuleDefinition(result.path));
          break;
        case 'const':
        case 'let':
        case 'var':
        case 'hoisted': {
          const blockParent = result.path.scope.getBlockParent();
          const programParent = result.path.scope.getProgramParent();

          if (blockParent === programParent) {
            const current = ctx.bindings.get(binding.name);
            if (current) {
              moduleBindings.push(current);
            } else if (isPathValid(result.path, t.isVariableDeclarator)) {
              const definitions = splitVariableDeclarator(ctx, result.path);
              // Push definition
              moduleBindings.push(...definitions);
              // Dedupe
              for (let k = 0, klen = definitions.length; k < klen; k++) {
                ctx.bindings.set(definitions[k].local, definitions[k]);
              }
            } else if (isPathValid(result.path, t.isFunctionDeclaration)) {
              const definition = splitFunctionDeclaration(ctx, result.path);
              moduleBindings.push(definition);
              // Dedupe
              ctx.bindings.set(definition.local, definition);
            }
          } else {
            localBindings.push(binding);
          }
        }
          break;
        case 'param':
          localBindings.push(bindings[i]);
          break;
        default:
          break;
      }
    }
  }

  const moduleDeclarations = moduleDefinitionsToImportDeclarations(moduleBindings);

  if (localBindings.length) {
    let body: t.Statement[];

    if (t.isArrowFunctionExpression(path.node)) {
      if (t.isBlockStatement(path.node.body)) {
        body = path.node.body.body;
      } else {
        body = [
          t.returnStatement(path.node.body),
        ];
      }
    } else {
      body = path.node.body.body;
    }

    path.node.body = t.blockStatement([
      t.variableDeclaration(
        'const',
        [
          t.variableDeclarator(
            t.arrayPattern(localBindings),
            t.callExpression(t.identifier(HIDDEN_USE_SCOPE), []),
          ),
        ],
      ),
      ...body,
    ]);

    moduleDeclarations.unshift(
      t.importDeclaration([
        t.importSpecifier(t.identifier(HIDDEN_USE_SCOPE), t.identifier(HIDDEN_USE_SCOPE)),
      ], t.stringLiteral('isolid')),
    );
  }

  const file = createVirtualFileName(ctx);
  const compiled = generator(
    t.program([
      ...moduleDeclarations,
      t.exportDefaultDeclaration(path.node),
    ]),
  );
  ctx.virtual.files.set(file, compiled.code);
  let identifier: t.Identifier;

  if (t.isArrowFunctionExpression(path.node) || !path.node.id) {
    identifier = path.scope.generateUidIdentifier('island');
  } else {
    identifier = path.node.id;
  }

  return {
    definition: {
      kind: 'default',
      local: identifier.name,
      source: file,
    },
    locals: localBindings,
  };
}

export default function transformComponent(
  ctx: SplitStateContext,
  path: babel.NodePath<t.CallExpression>,
  isServer: boolean,
) {
  // Check if first argument is an arrow function
  const arg = path.get('arguments')[0];
  if (
    arg
    && (
      isPathValid(arg, t.isArrowFunctionExpression)
      || isPathValid(arg, t.isFunctionExpression)
    )
  ) {
    const { definition, locals } = splitComponent(ctx, arg);
    const rootPath = getRootStatementPath(arg);

    rootPath.insertBefore(
      moduleDefinitionToImportDeclaration(definition),
    );

    const target = `${ctx.hash}-${ctx.clients.id++}`;

    if (!isServer) {
      ctx.clients.targets.set(target, definition.source);
    }

    const callback = (ctx.options.mode === 'client' && isServer)
      ? t.arrowFunctionExpression([], t.nullLiteral())
      : t.identifier(definition.local);

    path.replaceWith(
      t.callExpression(
        getImportIdentifier(
          ctx,
          path,
          'isolid',
          isServer ? HIDDEN_SERVER_COMPONENT : HIDDEN_CLIENT_COMPONENT,
        ),
        [
          t.stringLiteral(target),
          callback,
          t.arrowFunctionExpression([], t.arrayExpression(locals)),
        ],
      ),
    );

    path.scope.crawl();
  }
}
