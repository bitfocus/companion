/**
 * @typedef {import('@companion-module/base').CompanionVariableValue} VariableValue
 * @typedef {{
 *   values: Record<string, any>
 *   isComplete: boolean
 * }} ResolverState
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

	/** @type {ResolverState} */
	const resolverState = {
		values: {},
		isComplete: false,
	}

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
					case 'Compound': {
						let result
						// @ts-ignore
						for (const expr of node.body) {
							result = resolve(expr)
							if (resolverState.isComplete) return result
						}
						return result
					}
					case 'ArrayExpression': {
						const vals = []
						// @ts-ignore
						for (const elm of node.elements) {
							vals.push(resolve(elm))
						}
						return vals
					}
					case 'MemberExpression': {
						// @ts-ignore
						const object = resolve(node.object)
						// @ts-ignore
						const property = resolve(node.property)

						// propogate null
						if (object == null) return object

						return object?.[property]
					}
					case 'ObjectExpression': {
						/** @type {Record<any, any>} */
						const obj = {}
						// @ts-ignore
						for (const prop of node.properties) {
							if (prop.type !== 'Property') throw new Error(`Invalid property type in object: ${prop.type}`)

							// @ts-ignore
							const key = resolve(prop.key)
							// @ts-ignore
							const value = resolve(prop.value)

							obj[key] = value
						}
						return obj
					}
					case 'ReturnStatement': {
						if (resolverState.isComplete) throw new Error('Cannot return inside a return')

						resolverState.isComplete = true

						// @ts-ignore
						return resolve(node.argument)
					}
					case 'AssignmentExpression': {
						// @ts-ignore
						const rightValue = resolve(node.right)

						/** @type {any} */
						const left = node.left
						if (left.type !== 'Identifier') throw new Error('Can only assign to an Identifier')

						let newValue = resolverState.values[left.name]
						switch (node.operator) {
							case '=':
								newValue = rightValue
								break
							case '*=':
								newValue = Number(newValue) * Number(rightValue)
								break
							case '**=':
								newValue = Number(newValue) ** Number(rightValue)
								break
							case '/=':
								newValue = Number(newValue) / Number(rightValue)
								break
							case '%=':
								newValue = Number(newValue) % Number(rightValue)
								break
							case '+=':
								newValue = Number(newValue) + Number(rightValue)
								break
							case '-=':
								newValue = Number(newValue) - Number(rightValue)
								break
							case '<<=':
								newValue = Number(newValue) << Number(rightValue)
								break
							case '>>=':
								newValue = Number(newValue) >> Number(rightValue)
								break
							case '&=':
								newValue = Number(newValue) & Number(rightValue)
								break
							case '^=':
								newValue = Number(newValue) ^ Number(rightValue)
								break
							case '|=':
								newValue = Number(newValue) | Number(rightValue)
								break
							case '||=':
								newValue = newValue || rightValue
								break
							case '&&=':
								newValue = newValue || rightValue
								break
							default:
								throw new Error(`Unsupported assignment operator "${coreNode.operator}"`)
						}

						resolverState.values[left.name] = newValue
						return newValue
					}
					case 'UpdateExpression': {
						/** @type {any} */
						const arg = node.argument
						if (arg.type !== 'Identifier') throw new Error('Can only update an Identifier')

						switch (node.operator) {
							case '++':
								if (node.prefix) {
									return ++resolverState.values[arg.name]
								} else {
									return resolverState.values[arg.name]++
								}
							case '--':
								if (node.prefix) {
									return --resolverState.values[arg.name]
								} else {
									return resolverState.values[arg.name]--
								}
							default:
								throw new Error(`Unsupported assignment operator "${coreNode.operator}"`)
						}
					}
					case 'Identifier': {
						// @ts-ignore
						return resolverState.values[node.name]
					}
					// case 'Property':
					// 	// @ts-ignore
					// 	visitElements(node.key, visitor)
					// 	// @ts-ignore
					// 	visitElements(node.value, visitor)

					// 	break
					default:
						throw new Error(`Unknown node "${node.type}"`)
				}
		}
	}

	return resolve(node)
}
