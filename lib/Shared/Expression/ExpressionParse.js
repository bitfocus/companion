import jsep from 'jsep'
import jsepNumbers from '@jsep-plugin/numbers'
import jsepTemplateLiteral from '@jsep-plugin/template'

// setup plugins
jsep.plugins.register(jsepNumbers)
jsep.plugins.register(jsepTemplateLiteral) // TODO: Future use

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
	return jsep(expression)
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

	/**
	 * @param {jsep.Expression} node
	 * @returns {void}
	 */
	const checkNode = (node) => {
		/** @type {jsep.CoreExpression} */
		// @ts-ignore
		const coreNode = node
		switch (coreNode.type) {
			case 'Literal':
				// No variables
				break
			case 'UnaryExpression':
				checkNode(coreNode.argument)
				break
			case 'BinaryExpression':
				checkNode(coreNode.left)
				checkNode(coreNode.right)
				break
			case 'CallExpression':
				for (const arg of coreNode.arguments) {
					checkNode(arg)
				}
				break
			case 'ConditionalExpression':
				checkNode(coreNode.test)
				checkNode(coreNode.consequent)
				checkNode(coreNode.alternate)
				break
			default:
				switch (node.type) {
					case 'TemplateLiteral':
						// @ts-ignore
						for (const expr of node.expressions) {
							checkNode(expr)
						}
						break
					case 'CompanionVariable':
						if (node.name === undefined) throw new Error('Missing variable identifier')

						// @ts-ignore
						referencedVariables.push(node.name)
						break
					default:
						throw new Error(`Unknown node "${node.type}"`)
				}
		}
	}

	checkNode(node)

	return referencedVariables
}
