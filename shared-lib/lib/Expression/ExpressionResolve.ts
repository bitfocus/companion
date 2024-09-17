import type { CompanionVariableValue } from '@companion-module/base'
import type { SomeExpressionNode } from './ExpressionParse.js'
import type jsep from 'jsep'

interface ResolverState {
	values: Record<string, any>
	isComplete: boolean
}

/**
 *
 * @param {import('jsep').Expression} node
 * @param {(name: string) => VariableValue | undefined} getVariableValue
 * @param {Record<string, (...args: any[]) => any>} functions
 * @returns {VariableValue | undefined}
 */
export function ResolveExpression(
	node: SomeExpressionNode,
	getVariableValue: (name: string) => CompanionVariableValue | undefined,
	functions: Record<string, (...args: any[]) => any> = {}
): CompanionVariableValue | undefined {
	if (!node) throw new Error('Invalid expression')

	const resolverState: ResolverState = {
		values: {},
		isComplete: false,
	}

	const resolve = (rawNode: jsep.Expression): any => {
		const node = rawNode as SomeExpressionNode
		switch (node.type) {
			case 'Literal':
				return node.value

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
						throw new Error(`Unsupported binary operator "${node.operator}"`)
				}
			}
			case 'CallExpression': {
				// @ts-expect-error name is not typed
				const fn = functions[node.callee.name]
				if (!fn || typeof fn !== 'function') throw new Error(`Unsupported function "${node.callee.name}"`)
				const args = node.arguments.map((arg) => resolve(arg))
				return fn(...args)
			}
			case 'ConditionalExpression':
				return resolve(node.test) ? resolve(node.consequent) : resolve(node.alternate)

			default:
				switch (node.type) {
					case 'CompanionVariable': {
						if (node.name === undefined) throw new Error('Missing variable identifier')
						const value = getVariableValue(node.name)
						if (value === undefined) throw new Error(`Missing variable value for "${node.name}"`)
						return structuredClone(value)
					}
					case 'TemplateLiteral': {
						let result = ''

						for (let i = 0; i < node.quasis.length; i++) {
							const quasi = node.quasis[i]
							if (quasi.type !== 'TemplateElement')
								throw new Error(`Unsupported type for template element "${quasi.type}"`)

							result += quasi.value.raw

							if (!quasi.tail) {
								const expression = node.expressions[i]
								result += resolve(expression)
							}
						}

						return result
					}
					case 'Compound': {
						let result
						for (const expr of node.body) {
							result = resolve(expr)
							if (resolverState.isComplete) return result
						}
						return result
					}
					case 'ArrayExpression': {
						const vals = []
						for (const elm of node.elements) {
							if (elm) vals.push(resolve(elm))
						}
						return vals
					}
					case 'MemberExpression': {
						const object = resolve(node.object)
						const property = resolve(node.property)

						// propogate null
						if (object == null) return object

						return object?.[property]
					}
					case 'ObjectExpression': {
						const obj: Record<any, any> = {}
						for (const prop of node.properties) {
							if (prop.type !== 'Property') throw new Error(`Invalid property type in object: ${prop.type}`)

							const key = resolve(prop.key)
							const value = prop.value && resolve(prop.value)

							obj[key] = value
						}
						return obj
					}
					case 'ReturnStatement': {
						if (resolverState.isComplete) throw new Error('Cannot return inside a return')

						resolverState.isComplete = true

						return resolve(node.argument)
					}
					case 'AssignmentExpression': {
						const rightValue = resolve(node.right)

						const left = node.left as SomeExpressionNode
						if (left.type === 'Identifier') {
							const newValue = mutateValueForAssignment(node.operator, resolverState.values[left.name], rightValue)

							resolverState.values[left.name] = newValue
							return newValue
						} else if (left.type === 'MemberExpression') {
							const object = resolve(left.object)
							const property = resolve(left.property)

							const newValue = mutateValueForAssignment(node.operator, object[property], rightValue)

							object[property] = newValue
							return rightValue
						} else {
							throw new Error(`Cannot assign to an ${left.type}`)
						}
					}
					case 'UpdateExpression': {
						const arg = node.argument as SomeExpressionNode
						if (arg.type === 'Identifier') {
							const operator = node.operator
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
									throw new Error(`Unsupported assignment operator "${operator}"`)
							}
						} else if (arg.type === 'MemberExpression') {
							const object = resolve(arg.object)
							const property = resolve(arg.property)

							const operator = node.operator
							switch (node.operator) {
								case '++':
									if (node.prefix) {
										return ++object[property]
									} else {
										return object[property]++
									}
								case '--':
									if (node.prefix) {
										return --object[property]
									} else {
										return object[property]--
									}
								default:
									throw new Error(`Unsupported assignment operator "${operator}"`)
							}
						} else {
							throw new Error(`Cannot update ${arg.type}`)
						}
					}
					case 'Identifier': {
						return resolverState.values[node.name]
					}
					// case 'Property':
					// 	visitElements(node.key, visitor)
					// 	visitElements(node.value, visitor)

					// 	break
					default:
						throw new Error(`Unknown node "${node.type}"`)
				}
		}
	}

	return resolve(node)
}

/**
 * Mutate a value based on an assignment operator
 */
function mutateValueForAssignment(operator: unknown, leftValue: any, rightValue: any): any {
	switch (operator) {
		case '=':
			return rightValue
		case '*=':
			return Number(leftValue) * Number(rightValue)
		case '**=':
			return Number(leftValue) ** Number(rightValue)
		case '/=':
			return Number(leftValue) / Number(rightValue)
		case '%=':
			return Number(leftValue) % Number(rightValue)
		case '+=':
			return Number(leftValue) + Number(rightValue)
		case '-=':
			return Number(leftValue) - Number(rightValue)
		case '<<=':
			return Number(leftValue) << Number(rightValue)
		case '>>=':
			return Number(leftValue) >> Number(rightValue)
		case '&=':
			return Number(leftValue) & Number(rightValue)
		case '^=':
			return Number(leftValue) ^ Number(rightValue)
		case '|=':
			return Number(leftValue) | Number(rightValue)
		case '||=':
			return leftValue || rightValue
		case '&&=':
			return leftValue || rightValue
		default:
			throw new Error(`Unsupported assignment operator "${operator}"`)
	}
}
