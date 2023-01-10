import jsep from 'jsep'
import jsepNumbers from '@jsep-plugin/numbers'
import jsepTemplateLiteral from '@jsep-plugin/template'

// setup plugins
jsep.plugins.register(jsepNumbers)
jsep.plugins.register(jsepTemplateLiteral) // TODO: Future use

// remove some unwanted operators
jsep.removeBinaryOp('<<<')
jsep.removeBinaryOp('>>>')

const companionVariablesPlugin = {
	name: 'companion variables plugin',
	init(jsep) {
		// jsep.addIdentifierChar('$(')
		jsep.hooks.add('gobble-token', function myPlugin(env) {
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
		})
	},
}
jsep.plugins.register(companionVariablesPlugin)

export function ParseExpression(expression) {
	return jsep(expression)
}

export function FindAllReferencedVariables(node) {
	if (!node) throw new Error('Invalid expression')

	const referencedVariables = []

	const checkNode = (node) => {
		switch (node.type) {
			case 'Literal':
				// No variables
				break
			case 'CompanionVariable':
				if (node.name === undefined) throw new Error('Missing variable identifier')

				referencedVariables.push(node.name)
				break
			case 'UnaryExpression':
				checkNode(node.argument)
				break
			case 'BinaryExpression':
				checkNode(node.left)
				checkNode(node.right)
				break
			case 'CallExpression':
				for (const arg of node.arguments) {
					checkNode(arg)
				}
				break
			case 'ConditionalExpression':
				checkNode(node.test)
				checkNode(node.consequent)
				checkNode(node.alternate)
				break
			case 'TemplateLiteral':
				for (const expr of node.expressions) {
					checkNode(expr)
				}
				break
			default:
				throw new Error(`Unknown node "${node.type}"`)
		}
	}

	checkNode(node)

	return referencedVariables
}
