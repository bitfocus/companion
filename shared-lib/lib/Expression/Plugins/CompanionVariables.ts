import type jsep from 'jsep'

export interface CompanionVariableExpression extends jsep.Expression {
	type: 'CompanionVariable'
	name: string
}

export const CompanionVariablesPlugin: jsep.IPlugin = {
	name: 'companion variables plugin',
	init(jsep: any) {
		// jsep.addIdentifierChar('$(')
		jsep.hooks.add('gobble-token', function myPlugin(this: any, env: any) {
			const tokenStart = this.expr.slice(this.index, this.index + 2)
			if (tokenStart == '$(') {
				const end = this.expr.indexOf(')', this.index + 2)

				if (end !== -1) {
					env.node = {
						type: 'CompanionVariable',
						name: this.expr.slice(this.index + 2, end),
					}

					this.index = end + 1

					// Make sure any 'property' access on the variable gets gobbled as part of this node
					env.node = this.gobbleTokenProperty(env.node)
				}
			}
		})
	},
} as any
