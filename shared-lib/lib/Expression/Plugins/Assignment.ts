import type jsep from 'jsep'

const PLUS_CODE = 43 // +
const MINUS_CODE = 45 // -

export interface UpdateExpression extends jsep.Expression {
	type: 'UpdateExpression'
	operator: '++' | '--'
	argument: jsep.Expression
	prefix: boolean
}

export interface AssignmentExpression extends jsep.Expression {
	type: 'AssignmentExpression'
	operator: '=' | '*=' | '**=' | '/=' | '%=' | '+=' | '-=' | '<<=' | '>>=' | '>>>=' | '&=' | '^=' | '|='
	left: jsep.Expression
	right: jsep.Expression
}

const assignmentOperators = new Set([
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
])
const updateOperators = [PLUS_CODE, MINUS_CODE]
const assignmentPrecedence = 0.9

/**
 * Forked from https://github.com/EricSmekens/jsep/blob/master/packages/assignment/src/index.js to fix an issue with --1 throwing an error
 */
export const AssignmentPlugin: jsep.IPlugin = {
	name: 'assignment',

	init(jsep: any) {
		const updateNodeTypes = [jsep.IDENTIFIER, jsep.MEMBER_EXP]
		assignmentOperators.forEach((op) => jsep.addBinaryOp(op, assignmentPrecedence, true))

		jsep.hooks.add('gobble-token', function gobbleUpdatePrefix(this: any, env: any) {
			const code = this.code
			if (updateOperators.some((c) => c === code && c === this.expr.charCodeAt(this.index + 1))) {
				this.index += 2

				let identifier
				try {
					identifier = this.gobbleIdentifier()
				} catch (_e) {
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
		})

		jsep.hooks.add('after-token', function gobbleUpdatePostfix(this: any, env: any) {
			if (env.node) {
				const code = this.code
				if (updateOperators.some((c) => c === code && c === this.expr.charCodeAt(this.index + 1))) {
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
		})

		jsep.hooks.add('after-expression', function gobbleAssignment(this: any, env: any) {
			if (env.node) {
				// Note: Binaries can be chained in a single expression to respect
				// operator precedence (i.e. a = b = 1 + 2 + 3)
				// Update all binary assignment nodes in the tree
				updateBinariesToAssignments(env.node)
			}
		})

		function updateBinariesToAssignments(node: any) {
			if (assignmentOperators.has(node.operator)) {
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
} as any
