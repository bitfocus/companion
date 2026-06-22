import * as acorn from 'acorn'
import { ValidateExpression } from './ExpressionValidate.js'
import { companionVariablesAcornPlugin } from './Plugins/CompanionVariables.js'

// An acorn parser extended to understand Companion's `$(label:name)` variable references
const ExpressionAcornParser = acorn.Parser.extend(companionVariablesAcornPlugin)

const PARSE_OPTIONS: acorn.Options = {
	ecmaVersion: 'latest',
	sourceType: 'script',
	// The expression dialect supports a top-level `return`, which is a syntax error in plain script mode
	allowReturnOutsideFunction: true,
}

/**
 * The parsed form of an expression. This is an acorn `Program` node (ESTree), evaluated by ResolveExpression.
 */
export type SomeExpressionNode = acorn.Node

/**
 * Parse an expression into executable nodes
 */
export function ParseExpression(expression: string): SomeExpressionNode {
	let parsed: SomeExpressionNode
	try {
		parsed = ExpressionAcornParser.parse(expression, PARSE_OPTIONS)
	} catch (e) {
		// Normalise acorn's SyntaxError into a plain Error (preserving its message + position)
		throw new Error(e instanceof Error ? e.message : String(e))
	}

	// Reject any syntax the evaluator does not support, with a clear error
	ValidateExpression(parsed)

	return parsed
}

/**
 * Find all the referenced variables in an expression
 */
export function FindAllReferencedVariables(node: SomeExpressionNode): string[] {
	if (!node) throw new Error('Invalid expression')

	const referencedVariables: string[] = []

	walkNodes(node, (node) => {
		if (node.type === 'CompanionVariable') {
			const nodeName: string = node.name
			if (nodeName === undefined) throw new Error('Missing variable identifier')

			referencedVariables.push(nodeName)
		}
	})

	return referencedVariables
}

/**
 * Generic recursive walk over an acorn/ESTree AST, visiting every node.
 * This is intentionally structure-agnostic so it keeps working as new node types are allowed.
 */

function walkNodes(node: any, visit: (node: any) => void): void {
	if (!node || typeof node !== 'object') return

	if (Array.isArray(node)) {
		for (const child of node) walkNodes(child, visit)
		return
	}

	if (typeof node.type === 'string') visit(node)

	for (const key in node) {
		// `loc`/`range`/`start`/`end` carry positions, not child nodes
		if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue
		walkNodes(node[key], visit)
	}
}
