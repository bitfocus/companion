import jsep from 'jsep'
import jsepNumbers from '@jsep-plugin/numbers'
import jsepObject, { type ObjectExpression } from '@jsep-plugin/object'
import jsepTemplateLiteral, { type TemplateLiteral } from '@jsep-plugin/template'
import jsepComments from '@jsep-plugin/comment'
import { CompanionVariablesPlugin, type CompanionVariableExpression } from './Plugins/CompanionVariables.js'
import { AssignmentPlugin, type AssignmentExpression, type UpdateExpression } from './Plugins/Assignment.js'
import type { JsonValue } from 'type-fest'

// setup plugins
jsep.plugins.register(jsepNumbers)
jsep.plugins.register(jsepObject)
jsep.plugins.register(jsepTemplateLiteral)
jsep.plugins.register(jsepComments)
jsep.plugins.register(AssignmentPlugin)
jsep.plugins.register(CompanionVariablesPlugin)

// remove some unwanted operators
jsep.removeBinaryOp('<<<')
jsep.removeBinaryOp('>>>')

/**
 * Parse an expression into executable nodes
 */
export function ParseExpression(expression: string): SomeExpressionNode {
	const parsed = jsep(expression) as SomeExpressionNode

	fixupExpression(parsed)

	return parsed
}

/**
 * Convert a JSON value to an expression literal string that round-trips cleanly.
 * Strings are quoted, numbers/booleans are stringified, null/undefined become 'null'.
 */
export function valueToExpressionLiteral(value: JsonValue | undefined): string {
	if (value === null || value === undefined) return 'null'
	if (typeof value === 'string') return JSON.stringify(value)
	if (typeof value === 'number' || typeof value === 'boolean') return String(value)
	return JSON.stringify(value)
}

/**
 * Try to extract the raw JSON value from an expression that is a plain value definition
 * (a literal, a negative/positive number, an array or object of plain values).
 * Returns { value } if plain (no modal needed), or null if the expression is lossy
 * (involves computation, variable references, etc.) and a confirmation modal should be shown.
 */
export function tryExtractExpressionPlainValue(node: SomeExpressionNode): { value: JsonValue } | null {
	if (node.type === 'Literal') {
		// jsep Literal values are string | number | boolean | null (undefined is patched in by fixupExpression)
		return { value: node.value as JsonValue }
	}

	if (
		node.type === 'UnaryExpression' &&
		(node.operator === '-' || node.operator === '+') &&
		node.argument.type === 'Literal'
	) {
		const argValue = (node.argument as jsep.Literal).value
		if (typeof argValue === 'number') {
			return { value: node.operator === '-' ? -argValue : +argValue }
		}
		return null
	}

	if (node.type === 'ArrayExpression') {
		const values: JsonValue[] = []
		for (const element of node.elements) {
			if (!element) return null
			const extracted = tryExtractExpressionPlainValue(element as SomeExpressionNode)
			if (extracted === null) return null
			values.push(extracted.value)
		}
		return { value: values }
	}

	if (node.type === 'ObjectExpression') {
		const result: Record<string, JsonValue> = {}
		for (const prop of node.properties) {
			if (!prop.value) return null
			const keyNode = prop.key as jsep.Literal
			if (keyNode.type !== 'Literal' || typeof keyNode.value !== 'string') return null
			const extracted = tryExtractExpressionPlainValue(prop.value as SomeExpressionNode)
			if (extracted === null) return null
			result[keyNode.value] = extracted.value
		}
		return { value: result }
	}

	return null
}

/**
 * Find all the referenced variables in an expression
 */
export function FindAllReferencedVariables(node: jsep.Expression): string[] {
	if (!node) throw new Error('Invalid expression')

	const referencedVariables: string[] = []

	visitElements(node, (node) => {
		if (node.type === 'CompanionVariable') {
			// @ts-expect-error node.name is not typed
			const nodeName: string = node.name
			if (nodeName === undefined) throw new Error('Missing variable identifier')

			referencedVariables.push(nodeName)
		}
	})

	return referencedVariables
}

export interface ReturnExpression extends jsep.Expression {
	type: 'ReturnStatement'
	argument: jsep.Expression
}

export type SomeExpressionNode =
	| jsep.CoreExpression
	| ObjectExpression
	| TemplateLiteral
	| UpdateExpression
	| AssignmentExpression
	| CompanionVariableExpression
	| ReturnExpression

/**
 * Visit each node in the expression tree
 */
function visitElements(node: jsep.Expression, visitor: (node: jsep.Expression) => void): void {
	visitor(node)

	const coreNode: SomeExpressionNode = node as any
	switch (coreNode.type) {
		case 'Literal':
			// No variables
			break
		case 'UnaryExpression':
			visitElements(coreNode.argument, visitor)
			break
		case 'BinaryExpression':
			visitElements(coreNode.left, visitor)
			visitElements(coreNode.right, visitor)
			break
		case 'CallExpression':
			for (const arg of coreNode.arguments) {
				visitElements(arg, visitor)
			}
			break
		case 'ConditionalExpression':
			visitElements(coreNode.test, visitor)
			visitElements(coreNode.consequent, visitor)
			visitElements(coreNode.alternate, visitor)
			break
		case 'TemplateLiteral':
			for (const expr of coreNode.expressions) {
				visitElements(expr, visitor)
			}
			break
		case 'Compound':
			for (const expr of coreNode.body) {
				visitElements(expr, visitor)
			}
			break
		case 'CompanionVariable':
			// No children
			break
		case 'ArrayExpression':
			for (const expr of coreNode.elements) {
				if (expr) visitElements(expr, visitor)
			}
			break
		case 'MemberExpression':
			visitElements(coreNode.object, visitor)
			visitElements(coreNode.property, visitor)
			break
		case 'ObjectExpression':
			for (const prop of coreNode.properties) {
				visitElements(prop, visitor)
			}
			break
		case 'ReturnStatement':
		case 'UpdateExpression':
			visitElements(coreNode.argument, visitor)
			break
		case 'AssignmentExpression':
			visitElements(coreNode.left, visitor)
			visitElements(coreNode.right, visitor)
			break
		case 'Identifier':
			// console.log(node)
			// Nothing to do
			break
		default:
			switch (node.type) {
				case 'Property':
					// @ts-expect-error node.key is not typed
					visitElements(node.key, visitor)
					// @ts-expect-error node.value is not typed
					visitElements(node.value, visitor)

					break

				default:
					throw new Error(`Unknown node "${node.type}"`)
			}
	}
}

function fixReturnDetectedAsFunction(node: SomeExpressionNode): void {
	if (node.type === 'CallExpression' && node.callee.name === 'return' && node.arguments.length === 1) {
		const returnNode = node as any as ReturnExpression
		returnNode.type = 'ReturnStatement'

		// @ts-expect-error returnNode.arguments is not typed
		returnNode.argument = returnNode.arguments[0]

		delete returnNode.arguments
		delete returnNode.callee
	}
}

function fixupExpression(rootNode: SomeExpressionNode): void {
	visitElements(rootNode, (rawNode) => {
		const node = rawNode as SomeExpressionNode
		// Accept undefined
		if (node.type === 'Identifier' && node.name === 'undefined') {
			const literalNode = node as any as jsep.Literal
			literalNode.type = 'Literal'
			literalNode.raw = 'undefined'
			literalNode.value = undefined as any
			delete literalNode.name

			return
		}

		if (rootNode === node) {
			// Fixup return statements detected as a function, if at the root
			fixReturnDetectedAsFunction(node)
		}

		// Fix up object properties being defined as 'Identifier'
		if (node.type === 'ObjectExpression') {
			for (const prop of node.properties) {
				if (prop.key.type === 'Identifier') {
					prop.key = {
						// eslint-disable-next-line @typescript-eslint/no-base-to-string
						raw: `'${prop.key.name}'`,
						type: 'Literal',
						value: prop.key.name,
					}
				}
			}

			return
		}

		if (node.type === 'Compound' && node.body) {
			const body: SomeExpressionNode[] = node.body as any[]

			// Fixup return statements detected as a function
			for (const expr of body) {
				fixReturnDetectedAsFunction(expr)
			}

			// Combine a return identifier with the expression that follows
			for (let i = 0; i + 1 < body.length; i++) {
				const exprA = body[i]
				const exprB = body[i + 1]

				if (exprA.type === 'Identifier' && exprA.name === 'return') {
					const exprAReturn = exprA as any as ReturnExpression
					exprAReturn.type = 'ReturnStatement'
					exprAReturn.argument = exprB

					delete exprAReturn.name

					body.splice(i + 1, 1)
				}
			}

			// If the compound node contains just a single node now, flatten it
			if (body.length === 1) {
				delete (node as any).body
				Object.assign(node, body[0])
			}
		}
	})
}
