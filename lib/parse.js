// @flow

const _ = require('lodash')
const ts = require('typescript')
const Node = require('./nodes/node')
const NodeFactory = require('./nodes/factory')
const namespaceManager = require('./namespaceManager')
const printers = require('./printers')
const getNodeName = require('./nodename')
/*:: import type { Node as TSNode } from 'typescript'*/
/*:: import type { RawNode } from './nodes/node'*/

const parseNameFromNode = (node /*: RawNode*/) => {
  if (node.name && node.name.text) {
    return node.name.text
  } else if (node.type && node.type.typeName) {
    return node.type.typeName.text
  } else if (node.moduleSpecifier) {
    return node.moduleSpecifier.text
  } else if (node.expression) {
    return printers.node.printType(stripDetailsFromTree(node.expression))
  } else if (node.declarationList) {
    const declarations = node.declarationList.declarations
      .map(stripDetailsFromTree)
      .map(printers.node.printType)
      .join(' ')

    return declarations
  }

  return 'INVALID NAME REF'
}

// Traverse a node and strip information we dont care about
// This is mostly to make debugging a bit less verbose
const stripDetailsFromTree = (root /*: RawNode*/) => {
  const clone = _.omit(root, ['pos', 'end', 'parent', 'flags'])

  for (const key in clone) {
    const val = clone[key]

    if (clone.hasOwnProperty(key) && typeof val === 'object') {
      if (_.isArray(val)) {
        clone[key] = val.map(item => stripDetailsFromTree(item))
      } else {
        clone[key] = stripDetailsFromTree(val)
      }
    }
  }

  // Use actual names instead of node type IDs
  clone.kind = getNodeName(clone)

  return clone
}

const collectNode = (
  node /*: RawNode*/,
  context /*: Node*/,
  factory /*: Factory*/
) => {
  switch (node.kind) {
    case ts.SyntaxKind.ModuleDeclaration:
      if (
        node.flags === 4098 ||
        node.flags === 16 /* TODO: Replace with namespace flag enum */
      ) {
        const namespace = factory.createNamespaceNode(node.name.text)

        context.addChild('namespace' + node.name.text, namespace)

        namespaceManager.setContext(node.name.text)

        traverseNode(node.body, namespace, factory)
        break
      } else {
        const module = factory.createModuleNode(node.name.text)

        context.addChild(node.name.text, module)

        traverseNode(node.body, module, factory)
        break
      }

    case ts.SyntaxKind.FunctionDeclaration:
      context.addChild(
        parseNameFromNode(node),
        factory.createPropertyNode(node, parseNameFromNode(node))
      )
      break

    case ts.SyntaxKind.InterfaceDeclaration:
      context.addChild(
        parseNameFromNode(node),
        factory.createPropertyNode(node, parseNameFromNode(node))
      )
      break

    case ts.SyntaxKind.TypeAliasDeclaration:
      context.addChild(
        parseNameFromNode(node),
        factory.createPropertyNode(node, parseNameFromNode(node))
      )
      break

    case ts.SyntaxKind.ClassDeclaration:
      context.addChild(
        parseNameFromNode(node),
        factory.createPropertyNode(node)
      )
      break

    case ts.SyntaxKind.VariableStatement:
      context.addChild(
        parseNameFromNode(node),
        factory.createVariableNode(node)
      )
      break

    case ts.SyntaxKind.ExportAssignment:
      context.addChild(parseNameFromNode(node), factory.createExportNode(node))
      break

    case ts.SyntaxKind.ImportDeclaration:
      context.addChild(parseNameFromNode(node), factory.createImportNode(node))
      break

    case ts.SyntaxKind.ImportEqualsDeclaration:
      break
    case ts.SyntaxKind.EnumDeclaration:
      // not implemented
      break

    default:
      break
  }
}

// Walk the AST and extract all the definitions we care about
const traverseNode = (node, context /*: Node*/, factory /*: Factory*/) => {
  if (!node.statements) {
    collectNode(node, context, factory)
  } else {
    node.statements.forEach(n => collectNode(n, context, factory))
  }
}

function recursiveWalkTree(ast /*: any*/) {
  const factory = NodeFactory.create()

  const root = factory.createModuleNode('root')

  traverseNode(ast, root, factory)

  return root
}

function getMembersFromNode(node /*: any*/) {
  if (node.members) {
    return node.members
  }
}

module.exports = {
  parseNameFromNode,
  stripDetailsFromTree,
  recursiveWalkTree,
  getMembersFromNode
}
