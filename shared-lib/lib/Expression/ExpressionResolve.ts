import type { VariableValue } from '../Model/Variables.js'
import { SplitVariableId, VARIABLE_UNKNOWN_VALUE } from '../Variables.js'
import type { SomeExpressionNode } from './ExpressionParse.js'

/** Properties that must never be accessed or written via MemberExpression to prevent prototype pollution */
export const BANNED_PROPS = new Set([
	'__proto__',
	'constructor',
	'prototype',
	'__defineGetter__',
	'__defineSetter__',
	'__lookupGetter__',
	'__lookupSetter__',
])

interface ResolverState {
	values: Record<string, any>
	isComplete: boolean
}

export interface GetVariableValueProps {
	variableId: string
	label: string
	name: string
}

export function ResolveExpression(
	node: SomeExpressionNode,
	getVariableValueRaw: (props: GetVariableValueProps) => VariableValue | undefined,
	functionsRaw: Record<string, (...args: any[]) => any> = {}
): VariableValue | undefined {
	if (!node) throw new Error('Invalid expression')

	const getVariableValue = (variableIdOrLabel: string, nameOrUndefined?: string) => {
		if (nameOrUndefined !== undefined) {
			return getVariableValueRaw({
				variableId: `${variableIdOrLabel}:${nameOrUndefined}`,
				label: variableIdOrLabel,
				name: nameOrUndefined,
			})
		} else {
			const [label, name] = SplitVariableId(variableIdOrLabel)

			return getVariableValueRaw({ variableId: variableIdOrLabel, label, name })
		}
	}

	const functions: typeof functionsRaw = {
		...functionsRaw,
		getVariable: getVariableValue,
	}

	const resolverState: ResolverState = {
		values: Object.assign(Object.create(null), { PI: Math.PI }),
		isComplete: false,
	}

	// Resolve the property name of a MemberExpression/Property, honouring `computed`.
	// For non-computed access (`a.b`) the property is an Identifier name, not a value to evaluate.
	const resolveMemberProperty = (node: any): any => {
		if (node.computed) return resolve(node.property)
		if (node.property.type === 'Identifier') return node.property.name
		return resolve(node.property)
	}

	const resolve = (rawNode: any): any => {
		const node = rawNode
		switch (node.type) {
			case 'Program': {
				let result
				for (const statement of node.body) {
					result = resolve(statement)
					if (resolverState.isComplete) return result
				}
				return result
			}

			case 'ExpressionStatement':
				return resolve(node.expression)

			case 'EmptyStatement':
				return undefined

			case 'Literal':
				return node.value

			case 'Identifier':
				return resolverState.values[node.name]

			case 'UnaryExpression': {
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
					case '**':
						return Number(left) ** Number(right)
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

			case 'LogicalExpression': {
				// Note: both sides are evaluated eagerly, matching the previous jsep-based behaviour
				// (these operators used to be plain BinaryExpressions resolved the same way).
				const left = resolve(node.left)
				const right = resolve(node.right)
				switch (node.operator) {
					case '||':
						return left || right
					case '&&':
						return left && right
					case '??':
						return left ?? right
					default:
						throw new Error(`Unsupported logical operator "${node.operator}"`)
				}
			}

			case 'CallExpression': {
				const nodeName: string = node.callee.name

				const fn = functions[nodeName]
				if (!fn || typeof fn !== 'function') throw new Error(`Unsupported function "${nodeName}"`)
				const args = node.arguments.map((arg: any) => resolve(arg))
				return fn(...args)
			}

			case 'ConditionalExpression':
				return resolve(node.test) ? resolve(node.consequent) : resolve(node.alternate)

			case 'CompanionVariable': {
				if (node.name === undefined) throw new Error('Missing variable identifier')
				const value = getVariableValue(node.name)
				return structuredClone(value)
			}

			case 'TemplateLiteral': {
				let result = ''

				for (let i = 0; i < node.quasis.length; i++) {
					const quasi = node.quasis[i]
					if (quasi.type !== 'TemplateElement') throw new Error(`Unsupported type for template element "${quasi.type}"`)

					result += quasi.value.raw

					if (!quasi.tail) {
						const expression = node.expressions[i]

						let value = resolve(expression)
						if (value === undefined) value = VARIABLE_UNKNOWN_VALUE
						result += value
					}
				}

				return result
			}

			case 'SequenceExpression': {
				let result
				for (const expression of node.expressions) {
					result = resolve(expression)
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
				const property = resolveMemberProperty(node)

				// propagate null
				if (object == null) return object
				if (BANNED_PROPS.has(String(property))) throw new Error(`Access to property "${property}" is not allowed`)

				return object?.[property]
			}

			case 'ObjectExpression': {
				const obj: Record<any, any> = {}
				for (const prop of node.properties) {
					if (prop.type !== 'Property') throw new Error(`Invalid property type in object: ${prop.type}`)

					// Non-computed identifier keys (`{ a: 1 }`, `{ a }`) are literal property names, not variable lookups
					let key
					if (prop.computed) {
						key = resolve(prop.key)
					} else if (prop.key.type === 'Identifier') {
						key = prop.key.name
					} else {
						key = resolve(prop.key)
					}

					const value = prop.value && resolve(prop.value)

					obj[key] = value
				}
				return obj
			}

			case 'ReturnStatement': {
				if (resolverState.isComplete) throw new Error('Cannot return inside a return')

				resolverState.isComplete = true

				return node.argument ? resolve(node.argument) : undefined
			}

			case 'VariableDeclaration': {
				// Minimal support: bind declarators into the flat value store (no block scoping yet).
				let result
				for (const declarator of node.declarations) {
					if (declarator.id.type !== 'Identifier')
						throw new Error(`Unsupported variable declaration target "${declarator.id.type}"`)

					const value = declarator.init ? resolve(declarator.init) : undefined
					resolverState.values[declarator.id.name] = value
					result = value
				}
				return result
			}

			case 'AssignmentExpression': {
				const rightValue = resolve(node.right)

				const left = node.left
				if (left.type === 'Identifier') {
					const newValue = mutateValueForAssignment(node.operator, resolverState.values[left.name], rightValue)

					resolverState.values[left.name] = newValue
					return newValue
				} else if (left.type === 'MemberExpression') {
					const object = resolve(left.object)
					const property = resolveMemberProperty(left)
					if (BANNED_PROPS.has(String(property))) throw new Error(`Assignment to property "${property}" is not allowed`)

					const newValue = mutateValueForAssignment(node.operator, object[property], rightValue)

					object[property] = newValue
					return rightValue
				} else {
					throw new Error(`Cannot assign to an ${left.type}`)
				}
			}

			case 'UpdateExpression': {
				const arg = node.argument
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
					const property = resolveMemberProperty(arg)
					if (BANNED_PROPS.has(String(property))) throw new Error(`Update of property "${property}" is not allowed`)

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

			default:
				throw new Error(`Unknown node "${node.type}"`)
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
		case '??=':
			return leftValue ?? rightValue
		case '&&=':
			return leftValue && rightValue
		default:
			throw new Error(`Unsupported assignment operator "${operator}"`)
	}
}
