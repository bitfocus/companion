const PLUS_CODE = 43 // +
const MINUS_CODE = 45 // -

/**
 * Forked from https://github.com/EricSmekens/jsep/blob/master/packages/assignment/src/index.js to fix an issue with --1 throwing an error
 */
export const AssignmentPlugin = {
	name: 'assignment',

	assignmentOperators: new Set([
		'=',
		'*=',
		'**=',
		'/=',
		'%=',
		'+=',
		'-=',
		'<<=',
		'>>=',
		/* '>>>=',*/
		'&=',
		'^=',
		'|=',
		'&&=',
		'||=',
	]),
	updateOperators: [PLUS_CODE, MINUS_CODE],
	assignmentPrecedence: 0.9,

	init(/** @type {any} */ jsep) {
		const updateNodeTypes = [jsep.IDENTIFIER, jsep.MEMBER_EXP]
		AssignmentPlugin.assignmentOperators.forEach((op) =>
			jsep.addBinaryOp(op, AssignmentPlugin.assignmentPrecedence, true)
		)

		jsep.hooks.add(
			'gobble-token',
			/**
			 * TODO: this is bad, but necessary for now
			 * @this {any}
			 * @param {any} env
			 */
			function gobbleUpdatePrefix(env) {
				const code = this.code
				if (AssignmentPlugin.updateOperators.some((c) => c === code && c === this.expr.charCodeAt(this.index + 1))) {
					this.index += 2

					let identifier
					try {
						identifier = this.gobbleIdentifier()
					} catch (e) {
						// Let it be handled elsewhere
						this.index -= 2
					}
					if (identifier) {
						env.node = {
							type: 'UpdateExpression',
							operator: code === PLUS_CODE ? '++' : '--',
							argument: this.gobbleTokenProperty(identifier),
							prefix: true,
						}
						if (!env.node.argument || !updateNodeTypes.includes(env.node.argument.type)) {
							this.throwError(`Unexpected ${env.node.operator}`)
						}
					}
				}
			}
		)

		jsep.hooks.add(
			'after-token',
			/**
			 * TODO: this is bad, but necessary for now
			 * @this {any}
			 * @param {any} env
			 */
			function gobbleUpdatePostfix(env) {
				if (env.node) {
					const code = this.code
					if (AssignmentPlugin.updateOperators.some((c) => c === code && c === this.expr.charCodeAt(this.index + 1))) {
						if (!updateNodeTypes.includes(env.node.type)) {
							this.throwError(`Unexpected ${env.node.operator}`)
						}
						this.index += 2
						env.node = {
							type: 'UpdateExpression',
							operator: code === PLUS_CODE ? '++' : '--',
							argument: env.node,
							prefix: false,
						}
					}
				}
			}
		)

		jsep.hooks.add(
			'after-expression',
			/**
			 * TODO: this is bad, but necessary for now
			 * @this {any}
			 * @param {any} env
			 */ function gobbleAssignment(env) {
				if (env.node) {
					// Note: Binaries can be chained in a single expression to respect
					// operator precedence (i.e. a = b = 1 + 2 + 3)
					// Update all binary assignment nodes in the tree
					updateBinariesToAssignments(env.node)
				}
			}
		)

		function updateBinariesToAssignments(/** @type {any} */ node) {
			if (AssignmentPlugin.assignmentOperators.has(node.operator)) {
				node.type = 'AssignmentExpression'
				updateBinariesToAssignments(node.left)
				updateBinariesToAssignments(node.right)
			} else if (!node.operator) {
				Object.values(node).forEach((val) => {
					if (val && typeof val === 'object') {
						updateBinariesToAssignments(val)
					}
				})
			}
		}
	},
}
