import type { SomeExpressionNode } from './ExpressionParse.js'

/**
 * Validation pass for parsed expressions.
 *
 * We parse the full JavaScript grammar with acorn, then *subset by rejection*: this pass walks the AST
 * and throws a clear, positioned error for anything the expression dialect does not support. It is an
 * allowlist (default-deny) so that future JS/acorn additions cannot silently slip through.
 *
 * The set of allowed nodes/operators mirrors exactly what ResolveExpression implements today. As the
 * language grows (control flow, arrow functions, ...), the allowlist is extended alongside the evaluator.
 */

/** Node types the evaluator understands. Everything else is rejected. */
const ALLOWED_NODE_TYPES = new Set<string>([
	'Program',
	'ExpressionStatement',
	'EmptyStatement',
	'BlockStatement',
	'IfStatement',
	'WhileStatement',
	'ForStatement',
	'ForOfStatement',
	'BreakStatement',
	'ContinueStatement',
	'ArrowFunctionExpression',
	'Literal',
	'Identifier',
	'UnaryExpression',
	'BinaryExpression',
	'LogicalExpression',
	'CallExpression',
	'ConditionalExpression',
	'CompanionVariable',
	'TemplateLiteral',
	'TemplateElement',
	'SequenceExpression',
	'ArrayExpression',
	'ObjectExpression',
	'Property',
	'MemberExpression',
	'ChainExpression',
	'SpreadElement',
	'ReturnStatement',
	'VariableDeclaration',
	'VariableDeclarator',
	'AssignmentExpression',
	'UpdateExpression',
])

const ALLOWED_UNARY_OPERATORS = new Set(['-', '+', '!', '~'])
const ALLOWED_BINARY_OPERATORS = new Set([
	'+',
	'-',
	'*',
	'/',
	'%',
	'^',
	'**',
	'>>',
	'<<',
	'>=',
	'<=',
	'>',
	'<',
	'==',
	'!=',
	'===',
	'!==',
	'&',
	'|',
])
const ALLOWED_LOGICAL_OPERATORS = new Set(['||', '&&', '??'])
const ALLOWED_ASSIGNMENT_OPERATORS = new Set([
	'=',
	'*=',
	'**=',
	'/=',
	'%=',
	'+=',
	'-=',
	'<<=',
	'>>=',
	'&=',
	'^=',
	'|=',
	'||=',
	'&&=',
	'??=',
])
const ALLOWED_UPDATE_OPERATORS = new Set(['++', '--'])
const ALLOWED_DECLARATION_KINDS = new Set(['let', 'const'])

/** Friendlier messages for some commonly-hit rejected node types. */
const FRIENDLY_REJECTIONS: Record<string, string> = {
	AwaitExpression: '`await` is not supported',
	YieldExpression: '`yield` is not supported',
	ThisExpression: '`this` is not supported',
	TaggedTemplateExpression: 'Tagged template literals are not supported',
}

/**
 * Validate a parsed expression, throwing on any unsupported syntax.
 */
export function ValidateExpression(node: SomeExpressionNode): void {
	if (!node) throw new Error('Invalid expression')
	walk(node)
}

function fail(message: string, node: any): never {
	const position = typeof node?.start === 'number' ? ` at character ${node.start}` : ''
	throw new Error(`${message}${position}`)
}

function walk(node: any): void {
	if (!node || typeof node !== 'object') return

	if (Array.isArray(node)) {
		for (const child of node) walk(child)
		return
	}

	const type: unknown = node.type
	if (typeof type === 'string') {
		if (!ALLOWED_NODE_TYPES.has(type)) {
			fail(FRIENDLY_REJECTIONS[type] ?? `Unsupported syntax "${type}"`, node)
		}
		checkNode(node)
	}

	for (const key in node) {
		if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue
		walk(node[key])
	}
}

/** Per-node-type restrictions for nodes whose type is allowed but whose contents may not be. */

function checkNode(node: any): void {
	switch (node.type) {
		case 'Literal':
			// acorn represents regex and bigint as Literal nodes - neither is supported
			if (node.regex !== undefined) fail('Regular expression literals are not supported', node)
			if (node.bigint !== undefined || typeof node.value === 'bigint') fail('BigInt literals are not supported', node)
			break

		case 'UnaryExpression':
			if (!ALLOWED_UNARY_OPERATORS.has(node.operator)) fail(`Unsupported unary operator "${node.operator}"`, node)
			break

		case 'BinaryExpression':
			// Catches `>>>`, `in`, `instanceof`
			if (!ALLOWED_BINARY_OPERATORS.has(node.operator)) fail(`Unsupported binary operator "${node.operator}"`, node)
			break

		case 'LogicalExpression':
			if (!ALLOWED_LOGICAL_OPERATORS.has(node.operator)) fail(`Unsupported logical operator "${node.operator}"`, node)
			break

		case 'AssignmentExpression':
			// Catches `>>>=`
			if (!ALLOWED_ASSIGNMENT_OPERATORS.has(node.operator))
				fail(`Unsupported assignment operator "${node.operator}"`, node)
			break

		case 'UpdateExpression':
			if (!ALLOWED_UPDATE_OPERATORS.has(node.operator)) fail(`Unsupported update operator "${node.operator}"`, node)
			break

		case 'CallExpression':
			// Only bare function calls (`fn(...)`) are supported, not method calls or computed callees.
			if (node.callee?.type !== 'Identifier') fail('Only direct function calls are supported', node.callee ?? node)
			// Optional calls (`fn?.()`) don't fit the name-based function model
			if (node.optional) fail('Optional function calls (`?.()`) are not supported', node)
			break

		case 'Property':
			if (node.kind !== 'init') fail('Getters/setters and object methods are not supported', node)
			break

		case 'VariableDeclaration':
			if (!ALLOWED_DECLARATION_KINDS.has(node.kind))
				fail(`Unsupported variable declaration "${node.kind}" (use let or const)`, node)
			break

		case 'VariableDeclarator':
			if (node.id?.type !== 'Identifier') fail('Destructuring declarations are not supported', node.id ?? node)
			break

		case 'ArrowFunctionExpression':
			if (node.async) fail('Async functions are not supported', node)
			for (const param of node.params) {
				if (param.type !== 'Identifier') fail('Only simple arrow function parameters are supported', param)
			}
			break

		case 'ForOfStatement':
			if (node.await) fail('`for await` is not supported', node)
			break

		case 'BreakStatement':
		case 'ContinueStatement':
			if (node.label) fail('Labelled break/continue is not supported', node)
			break

		default:
			break
	}
}
