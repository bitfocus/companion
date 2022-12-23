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

				env.node = {
					type: 'CompanionVariable',
					name: this.expr.slice(this.index + 2, end),
				}

				this.index = end + 1
			}
		})
	},
}
jsep.plugins.register(companionVariablesPlugin)

export function ParseExpression(expression) {
	return jsep(expression)
}
