/**
 * @typedef {import('@companion-module/base').CompanionVariableValue} VariableValue
 */

/**
 *
 * @param {import('jsep').Expression} node
 * @param {(name: string) => VariableValue | undefined} getVariableValue
 * @param {Record<string, (...args: any[]) => any>} functions
 * @returns {VariableValue | undefined}
 */
export function ResolveExpression(node, getVariableValue, functions = {}) {
	if (!node) throw new Error('Invalid expression')

	/**
	 * @param {import('jsep').Expression} node
	 * @returns {any}
	 */
	const resolve = (node) => {
		/** @type {import('jsep').CoreExpression} */
		// @ts-ignore
		const coreNode = node
		switch (coreNode.type) {
			case 'Literal':
				return coreNode.value

			case 'UnaryExpression':
				if (!coreNode.prefix) throw new Error('Unexpected Unary non-prefix')

				const arg = resolve(coreNode.argument)

				switch (coreNode.operator) {
					case '-':
						return -arg
					case '+':
						return +arg
					case '!':
						return !arg
					case '~':
						return ~arg
					default:
						throw new Error(`Unsupported unary operator "${coreNode.operator}"`)
				}

			case 'BinaryExpression': {
				const left = resolve(coreNode.left)
				const right = resolve(coreNode.right)
				switch (coreNode.operator) {
					case '+':
						return Number(left) + Number(right)
					case '-':
						return Number(left) - Number(right)
					case '*':
						return Number(left) * Number(right)
					case '/':
						return Number(left) / Number(right)
					case '%':
						return Number(left) % Number(right)
					case '^':
						return Number(left) ^ Number(right)
					case '||':
						return left || right
					case '&&':
						return left && right
					case '>>':
						return Number(left) >> Number(right)
					case '<<':
						return Number(left) << Number(right)
					case '>=':
						return Number(left) >= Number(right)
					case '<=':
						return Number(left) <= Number(right)
					case '>':
						return Number(left) > Number(right)
					case '<':
						return Number(left) < Number(right)
					case '==':
						return left == right
					case '!=':
						return left != right
					case '===':
						return left === right
					case '!==':
						return left !== right
					case '&':
						return Number(left) & Number(right)
					case '|':
						return Number(left) | Number(right)

					default:
						throw new Error(`Unsupported binary operator "${coreNode.operator}"`)
				}
			}
			case 'CallExpression': {
				// @ts-ignore
				const fn = functions[coreNode.callee.name]
				if (!fn || typeof fn !== 'function') throw new Error(`Unsupported function "${coreNode.callee.name}"`)
				const args = coreNode.arguments.map((arg) => resolve(arg))
				return fn(...args)
			}
			case 'ConditionalExpression':
				return resolve(coreNode.test) ? resolve(coreNode.consequent) : resolve(coreNode.alternate)

			default:
				switch (node.type) {
					case 'CompanionVariable': {
						if (node.name === undefined) throw new Error('Missing variable identifier')
						// @ts-ignore
						const value = getVariableValue(node.name)
						if (value === undefined) throw new Error(`Missing variable value for "${coreNode.name}"`)
						return value
					}
					case 'TemplateLiteral': {
						let result = ''

						// @ts-ignore
						for (let i = 0; i < node.quasis.length; i++) {
							// @ts-ignore
							const quasi = node.quasis[i]
							if (quasi.type !== 'TemplateElement')
								throw new Error(`Unsupported type for template element "${quasi.type}"`)

							result += quasi.value.raw

							if (!quasi.tail) {
								// @ts-ignore
								const expression = node.expressions[i]
								result += resolve(expression)
							}
						}

						return result
					}
					default:
						throw new Error(`Unknown node "${node.type}"`)
				}
		}
	}

	return resolve(node)
}
