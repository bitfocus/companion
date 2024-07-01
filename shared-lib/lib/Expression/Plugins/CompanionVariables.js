import jsep from 'jsep'

/** @type{jsep.IPlugin} */
export const CompanionVariablesPlugin = {
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
