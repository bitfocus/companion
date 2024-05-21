import jsep from 'jsep'
import jsepNumbers from '@jsep-plugin/numbers'
import jsepObject from '@jsep-plugin/object'
import jsepTemplateLiteral from '@jsep-plugin/template'
import jsepComments from '@jsep-plugin/comment'
// import jsepAssignment from '@jsep-plugin/assignment'

// setup plugins
jsep.plugins.register(jsepNumbers)
jsep.plugins.register(jsepObject)
jsep.plugins.register(jsepTemplateLiteral)
jsep.plugins.register(jsepComments)
// jsep.plugins.register(jsepAssignment)

// remove some unwanted operators
jsep.removeBinaryOp('<<<')
jsep.removeBinaryOp('>>>')

/** @type{jsep.IPlugin} */
const companionVariablesPlugin = {
	name: 'companion variables plugin',
	init(/** @type {any} */ jsep) {
		// jsep.addIdentifierChar('$(')
		jsep.hooks.add(
			'gobble-token',
			/**
			 * TODO: this is bad, but necessary for now
			 * @this {any}
			 * @param {any} env
			 */
			function myPlugin(env) {
				const tokenStart = this.expr.slice(this.index, this.index + 2)
				if (tokenStart == '$(') {
					const end = this.expr.indexOf(')', this.index + 2)

					if (end !== -1) {
						env.node = {
							type: 'CompanionVariable',
							name: this.expr.slice(this.index + 2, end),
						}

						this.index = end + 1
					}
				}
			}
		)
	},
}
jsep.plugins.register(companionVariablesPlugin)

/**
 * Parse an expression into executable nodes
 * @param {string} expression
 * @returns {jsep.Expression}
 */
export function ParseExpression(expression) {
	const parsed = jsep(expression)

	fixupExpression(parsed)

	return parsed
}

/**
 * Find all the referenced variables in an expression
 * @param {jsep.Expression} node
 * @returns {string[]}
 */
export function FindAllReferencedVariables(node) {
	if (!node) throw new Error('Invalid expression')

	/** @type {string[]} */
	const referencedVariables = []

	visitElements(node, (node) => {
		if (node.type === 'CompanionVariable') {
			if (node.name === undefined) throw new Error('Missing variable identifier')

			// @ts-ignore
			referencedVariables.push(node.name)
		}
	})

	return referencedVariables
}

/**
 * Visit each node in the expression tree
 * @param {jsep.Expression} node
 * @param {(node: jsep.Expression) => void} visitor
 */
function visitElements(node, visitor) {
	visitor(node)

	/** @type {jsep.CoreExpression} */
	// @ts-ignore
	const coreNode = node
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
		default:
			switch (node.type) {
				case 'TemplateLiteral':
					// @ts-ignore
					for (const expr of node.expressions) {
						visitElements(expr, visitor)
					}
					break
				case 'CompanionVariable':
					// No children
					break
				case 'Compound':
					// @ts-ignore
					for (const expr of node.body) {
						visitElements(expr, visitor)
					}
					break
				case 'ArrayExpression':
					// @ts-ignore
					for (const expr of node.elements) {
						visitElements(expr, visitor)
					}
					break
				case 'MemberExpression':
					// @ts-ignore
					visitElements(node.object, visitor)
					// @ts-ignore
					visitElements(node.property, visitor)
					break
				case 'ObjectExpression':
					// @ts-ignore
					for (const prop of node.properties) {
						visitElements(prop, visitor)
					}
					break
				case 'Property':
					// @ts-ignore
					visitElements(node.key, visitor)
					// @ts-ignore
					visitElements(node.value, visitor)

					break
				default:
					throw new Error(`Unknown node "${node.type}"`)
			}
	}
}

/**
 *
 * @param {jsep.Expression} node
 */
function fixupExpression(node) {
	visitElements(node, (node) => {
		// Accept undefined
		if (node.type === 'Identifier' && node.name === 'undefined') {
			node.type = 'Literal'
			node.raw = 'undefined'
			node.value = undefined
			delete node.name

			return
		}

		// Fix up object properties being defined as 'Identifier'
		if (node.type === 'ObjectExpression') {
			// @ts-ignore
			for (const prop of node.properties) {
				if (prop.key.type === 'Identifier') {
					prop.key = {
						raw: `'${prop.key.name}'`,
						type: 'Literal',
						value: prop.key.name,
					}
				}
			}

			return
		}

		// Fix up a $(my:var)[1]
		if (node.type === 'Compound' && node.body) {
			/** @type {jsep.Expression[]} */
			// @ts-ignore
			const body = node.body

			if (
				body.length === 2 &&
				body[0].type === 'CompanionVariable' &&
				body[1].type === 'ArrayExpression' &&
				// @ts-ignore
				body[1].elements.length === 1
			) {
				node.computed = true
				node.type = 'MemberExpression'
				node.object = body[0]
				// @ts-ignore
				node.property = body[1].elements[0]

				delete node.body
			}
		}
	})
}
