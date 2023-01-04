export function ResolveExpression(node, getVariableValue, functions = {}) {
	if (!node) throw new Error('Invalid expression')

	const resolve = (node) => {
		switch (node.type) {
			case 'Literal':
				return node.value
			case 'CompanionVariable': {
				if (node.name === undefined) throw new Error('Missing variable identifier')
				const value = getVariableValue(node.name)
				if (value === undefined) throw new Error(`Missing variable value for "${node.name}"`)
				return value
			}
			case 'UnaryExpression':
				if (!node.prefix) throw new Error('Unexpected Unary non-prefix')

				const arg = resolve(node.argument)

				switch (node.operator) {
					case '-':
						return -arg
					case '+':
						return +arg
					case '!':
						return !arg
					case '~':
						return ~arg
					default:
						throw new Error(`Unsupported unary operator "${node.operator}"`)
				}

			case 'BinaryExpression': {
				const left = resolve(node.left)
				const right = resolve(node.right)
				switch (node.operator) {
					case '+':
						return left + right
					case '-':
						return left - right
					case '*':
						return left * right
					case '/':
						return left / right
					case '%':
						return left % right
					case '^':
						return left ^ right
					case '||':
						return left || right
					case '&&':
						return left && right
					case '>>':
						return left >> right
					case '<<':
						return left << right
					case '>=':
						return left >= right
					case '<=':
						return left <= right
					case '>':
						return left > right
					case '<':
						return left < right
					case '==':
						return left == right
					case '!=':
						return left != right
					case '===':
						return left === right
					case '!==':
						return left !== right
					case '&':
						return left & right
					case '|':
						return left | right

					default:
						throw new Error(`Unsupported binary operator "${node.operator}"`)
				}
			}
			case 'CallExpression': {
				const fn = functions[node.callee.name]
				if (!fn || typeof fn !== 'function') throw new Error(`Unsupported function "${node.callee.name}"`)
				const args = node.arguments.map((arg) => resolve(arg))
				return fn(...args)
			}
			case 'ConditionalExpression':
				return resolve(node.test) ? resolve(node.consequent) : resolve(node.alternate)
			case 'TemplateLiteral': {
				let result = ''

				for (let i = 0; i < node.quasis.length; i++) {
					const quasi = node.quasis[i]
					if (quasi.type !== 'TemplateElement') throw new Error(`Unsupported type for template element "${quasi.type}"`)

					result += quasi.value.raw

					if (!quasi.tail) {
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

	return resolve(node)
}
