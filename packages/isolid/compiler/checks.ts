import * as t from '@babel/types';
import * as babel from '@babel/core';

export function getImportSpecifierName(node: t.ImportSpecifier) {
  switch (node.imported.type) {
    case 'Identifier': return node.imported.name;
    case 'StringLiteral': return node.imported.value;
    default: return '';
  }
}

type TypeFilter<V extends t.Node> = (node: t.Node) => node is V;

export function isPathValid<V extends t.Node>(
  path: unknown,
  key: TypeFilter<V>,
): path is babel.NodePath<V> {
  return key((path as babel.NodePath).node);
}

export type NestedExpression =
  | t.ParenthesizedExpression
  | t.TypeCastExpression
  | t.TSAsExpression
  | t.TSSatisfiesExpression
  | t.TSNonNullExpression
  | t.TSInstantiationExpression
  | t.TSTypeAssertion;

export function isNestedExpression(node: t.Node): node is NestedExpression {
  switch (node.type) {
    case 'ParenthesizedExpression':
    case 'TypeCastExpression':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'TSTypeAssertion':
    case 'TSInstantiationExpression':
      return true;
    default:
      return false;
  }
}
