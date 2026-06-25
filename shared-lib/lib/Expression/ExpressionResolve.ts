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

// Execution budget. These are deliberately generous but finite, so a worst-case script (infinite loop,
// runaway recursion) fails fast instead of stalling the process. Reset per top-level evaluation.
// Configurable per call site via ResolveExpressionOptions - e.g. cheap/hot paths like option visibility
// checks can pass a much lower limit.
export const DEFAULT_MAX_OPERATIONS = 1_000_000
export const DEFAULT_MAX_CALL_DEPTH = 250

export interface ResolveExpressionOptions {
	/** Maximum number of loop iterations + function calls before aborting (default DEFAULT_MAX_OPERATIONS) */
	maxOperations?: number
	/** Maximum closure call-stack depth before aborting (default DEFAULT_MAX_CALL_DEPTH) */
	maxCallDepth?: number
}

/** Thrown when the execution budget is exceeded. Not catchable by user code (the dialect has no try/catch). */
class ExpressionBudgetError extends Error {}

// Control-flow signals, implemented as thrown sentinels caught at the appropriate boundary.
class ReturnSignal {
	constructor(public readonly value: any) {}
}
class BreakSignal {}
class ContinueSignal {}

interface Binding {
	value: any
	isConst: boolean
}

/**
 * A lexical scope with a parent pointer. Lookups walk the chain.
 *  - `let`/`const` declare in the current scope (may shadow a parent).
 *  - a bare assignment writes to the nearest existing binding, or implicitly declares in the current scope.
 */
class Environment {
	private readonly bindings = new Map<string, Binding>()

	constructor(private readonly parent: Environment | null = null) {}

	private owner(name: string): Environment | null {
		let env: Environment | null = this
		while (env) {
			if (env.bindings.has(name)) return env
			env = env.parent
		}
		return null
	}

	has(name: string): boolean {
		return this.owner(name) !== null
	}

	get(name: string): any {
		return this.owner(name)?.bindings.get(name)?.value
	}

	declare(name: string, value: any, isConst: boolean): void {
		if (this.bindings.has(name)) throw new Error(`Identifier "${name}" has already been declared`)
		this.bindings.set(name, { value, isConst })
	}

	assign(name: string, value: any): void {
		const owner = this.owner(name)
		if (owner) {
			const binding = owner.bindings.get(name)!
			if (binding.isConst) throw new Error(`Assignment to constant "${name}"`)
			binding.value = value
		} else {
			// Implicit declaration in the current scope
			this.bindings.set(name, { value, isConst: false })
		}
	}
}

export interface GetVariableValueProps {
	variableId: string
	label: string
	name: string
}

export function ResolveExpression(
	node: SomeExpressionNode,
	getVariableValueRaw: (props: GetVariableValueProps) => VariableValue | undefined,
	functionsRaw: Record<string, (...args: any[]) => any> = {},
	options: ResolveExpressionOptions = {}
): VariableValue | undefined {
	if (!node) throw new Error('Invalid expression')

	const maxOperations = options.maxOperations ?? DEFAULT_MAX_OPERATIONS
	const maxCallDepth = options.maxCallDepth ?? DEFAULT_MAX_CALL_DEPTH

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

	// Null-prototype map so that only the provided builtins are callable - a call like `constructor()`
	// or `toString()` must not resolve to an inherited Object.prototype method.
	const functions: typeof functionsRaw = Object.assign(Object.create(null), functionsRaw, {
		getVariable: getVariableValue,
	})

	// Per-evaluation execution budget
	let operations = 0
	let callDepth = 0
	const tickOperation = () => {
		if (++operations > maxOperations)
			throw new ExpressionBudgetError('Expression evaluation exceeded the maximum number of operations')
	}

	const rootEnv = new Environment(null)
	rootEnv.declare('PI', Math.PI, false)

	// Resolve the property name of a MemberExpression, honouring `computed`.
	// For non-computed access (`a.b`) the property is an Identifier name, not a value to evaluate.
	const resolveMemberProperty = (node: any, env: Environment): any => {
		if (node.computed) return evalNode(node.property, env)
		if (node.property.type === 'Identifier') return node.property.name
		return evalNode(node.property, env)
	}

	// Build a closure (arrow function) value: a real JS function so it can also be passed to builtins.
	const makeClosure = (fnNode: any, defEnv: Environment): ((...args: any[]) => any) => {
		const params: any[] = fnNode.params
		const body = fnNode.body
		const isExpressionBody: boolean = fnNode.expression

		return (...args: any[]): any => {
			tickOperation()
			if (callDepth >= maxCallDepth)
				throw new ExpressionBudgetError('Expression evaluation exceeded the maximum call depth')
			callDepth++
			try {
				const fnEnv = new Environment(defEnv)
				for (let i = 0; i < params.length; i++) fnEnv.declare(params[i].name, args[i], false)

				if (isExpressionBody) return evalNode(body, fnEnv)

				try {
					evalNode(body, fnEnv)
				} catch (e) {
					if (e instanceof ReturnSignal) return e.value
					throw e
				}
				return undefined
			} finally {
				callDepth--
			}
		}
	}

	// Run a loop body once, returning 'break' if the loop should stop. `continue` falls through normally.
	const runLoopBody = (body: any, env: Environment): 'break' | undefined => {
		tickOperation()
		try {
			evalNode(body, env)
		} catch (e) {
			if (e instanceof BreakSignal) return 'break'
			if (e instanceof ContinueSignal) return undefined
			throw e
		}
		return undefined
	}

	const bindForOfTarget = (left: any, value: any, env: Environment): void => {
		if (left.type === 'VariableDeclaration') {
			const declarator = left.declarations[0]
			env.declare(declarator.id.name, value, left.kind === 'const')
		} else if (left.type === 'Identifier') {
			env.assign(left.name, value)
		} else {
			throw new Error(`Unsupported for...of target "${left.type}"`)
		}
	}

	const evalNode = (rawNode: any, env: Environment): any => {
		const node = rawNode
		switch (node.type) {
			case 'Program': {
				try {
					let result
					for (const statement of node.body) result = evalNode(statement, env)
					return result
				} catch (e) {
					if (e instanceof ReturnSignal) return e.value
					if (e instanceof BreakSignal || e instanceof ContinueSignal)
						throw new Error('Illegal break/continue statement')
					throw e
				}
			}

			case 'BlockStatement': {
				const blockEnv = new Environment(env)
				for (const statement of node.body) evalNode(statement, blockEnv)
				return undefined
			}

			case 'ExpressionStatement':
				return evalNode(node.expression, env)

			case 'EmptyStatement':
				return undefined

			case 'IfStatement': {
				if (evalNode(node.test, env)) {
					evalNode(node.consequent, env)
				} else if (node.alternate) {
					evalNode(node.alternate, env)
				}
				return undefined
			}

			case 'WhileStatement': {
				while (evalNode(node.test, env)) {
					if (runLoopBody(node.body, env) === 'break') break
				}
				return undefined
			}

			case 'ForStatement': {
				const forEnv = new Environment(env)
				if (node.init) evalNode(node.init, forEnv)

				// Per-iteration scoping for `let`/`const` loop variables, so closures created in the body
				// capture that iteration's value (matching JS `let` semantics). Each iteration runs in a
				// fresh environment seeded with copies of the loop bindings.
				const isLetDeclaration = node.init?.type === 'VariableDeclaration' && node.init.kind !== 'var'
				const perIterationNames: string[] = isLetDeclaration
					? node.init.declarations.map((declarator: any) => declarator.id.name)
					: []
				const isConst = node.init?.type === 'VariableDeclaration' && node.init.kind === 'const'

				const nextIterationEnv = (previous: Environment): Environment => {
					if (perIterationNames.length === 0) return previous
					const fresh = new Environment(env)
					for (const name of perIterationNames) fresh.declare(name, previous.get(name), isConst)
					return fresh
				}

				let runningEnv = nextIterationEnv(forEnv)
				while (node.test ? evalNode(node.test, runningEnv) : true) {
					if (runLoopBody(node.body, runningEnv) === 'break') break
					runningEnv = nextIterationEnv(runningEnv)
					if (node.update) evalNode(node.update, runningEnv)
				}
				return undefined
			}

			case 'ForOfStatement': {
				const iterable = spreadIterable(evalNode(node.right, env))
				for (const item of iterable) {
					const iterEnv = new Environment(env)
					bindForOfTarget(node.left, item, iterEnv)
					if (runLoopBody(node.body, iterEnv) === 'break') break
				}
				return undefined
			}

			case 'ReturnStatement':
				// These sentinels are control-flow signals, not errors (kept lightweight, no stack capture)
				// eslint-disable-next-line @typescript-eslint/only-throw-error
				throw new ReturnSignal(node.argument ? evalNode(node.argument, env) : undefined)

			case 'BreakStatement':
				// eslint-disable-next-line @typescript-eslint/only-throw-error
				throw new BreakSignal()

			case 'ContinueStatement':
				// eslint-disable-next-line @typescript-eslint/only-throw-error
				throw new ContinueSignal()

			case 'ArrowFunctionExpression':
				return makeClosure(node, env)

			case 'Literal':
				return node.value

			case 'Identifier':
				return env.get(node.name)

			case 'UnaryExpression': {
				if (!node.prefix) throw new Error('Unexpected Unary non-prefix')

				const arg = evalNode(node.argument, env)

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
				const left = evalNode(node.left, env)
				const right = evalNode(node.right, env)
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
				const left = evalNode(node.left, env)
				const right = evalNode(node.right, env)
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
				const name: string = node.callee.name

				const args: any[] = []
				for (const arg of node.arguments) {
					if (arg.type === 'SpreadElement') {
						args.push(...spreadIterable(evalNode(arg.argument, env)))
					} else {
						args.push(evalNode(arg, env))
					}
				}

				// A user-defined function (arrow) bound in scope takes precedence over a builtin
				const scoped = env.has(name) ? env.get(name) : undefined
				const fn = typeof scoped === 'function' ? scoped : functions[name]
				if (typeof fn !== 'function') throw new Error(`Unsupported function "${name}"`)
				return fn(...args)
			}

			case 'ConditionalExpression':
				return evalNode(node.test, env) ? evalNode(node.consequent, env) : evalNode(node.alternate, env)

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

						let value = evalNode(expression, env)
						if (value === undefined) value = VARIABLE_UNKNOWN_VALUE
						result += value
					}
				}

				return result
			}

			case 'SequenceExpression': {
				let result
				for (const expression of node.expressions) {
					result = evalNode(expression, env)
				}
				return result
			}

			case 'ArrayExpression': {
				const vals = []
				for (const elm of node.elements) {
					if (!elm) continue // holes (`[1, , 3]`)
					if (elm.type === 'SpreadElement') {
						vals.push(...spreadIterable(evalNode(elm.argument, env)))
					} else {
						vals.push(evalNode(elm, env))
					}
				}
				return vals
			}

			case 'ChainExpression':
				// Wrapper acorn places around an optional chain (`a?.b`); the inner expression does the work
				return evalNode(node.expression, env)

			case 'MemberExpression': {
				const object = evalNode(node.object, env)
				const property = resolveMemberProperty(node, env)

				// propagate null - `a?.b` short-circuits to undefined, `a.b` keeps the existing lenient null
				if (object == null) return node.optional ? undefined : object
				if (BANNED_PROPS.has(String(property))) throw new Error(`Access to property "${property}" is not allowed`)

				// Only expose own, enumerable (data) properties: object keys and array indices.
				// Built-in/inherited members such as `length` or array/string methods are not accessible.
				if (!Object.prototype.propertyIsEnumerable.call(object, property as PropertyKey)) return undefined

				return object[property]
			}

			case 'ObjectExpression': {
				const obj: Record<any, any> = {}
				for (const prop of node.properties) {
					if (prop.type === 'SpreadElement') {
						// Object spread (`{ ...a }`): copy own enumerable properties, like the data-only member model.
						// Uses direct assignment of own keys (not Object.assign) so it cannot trigger prototype pollution.
						const source = evalNode(prop.argument, env)
						if (source != null) {
							for (const sourceKey of Object.keys(source)) {
								if (!BANNED_PROPS.has(sourceKey)) obj[sourceKey] = source[sourceKey]
							}
						}
						continue
					}

					if (prop.type !== 'Property') throw new Error(`Invalid property type in object: ${prop.type}`)

					// Non-computed identifier keys (`{ a: 1 }`, `{ a }`) are literal property names, not variable lookups
					let key
					if (prop.computed) {
						key = evalNode(prop.key, env)
					} else if (prop.key.type === 'Identifier') {
						key = prop.key.name
					} else {
						key = evalNode(prop.key, env)
					}

					// Block `__proto__`/`constructor`/etc. as keys so an object literal can't reach or
					// reassign a prototype (e.g. `{ __proto__: x }` or `{ ['__proto__']: x }`).
					if (BANNED_PROPS.has(String(key))) throw new Error(`Assignment to property "${key}" is not allowed`)

					const value = prop.value && evalNode(prop.value, env)

					obj[key] = value
				}
				return obj
			}

			case 'VariableDeclaration': {
				const isConst = node.kind === 'const'
				let result
				for (const declarator of node.declarations) {
					if (declarator.id.type !== 'Identifier')
						throw new Error(`Unsupported variable declaration target "${declarator.id.type}"`)

					const value = declarator.init ? evalNode(declarator.init, env) : undefined
					env.declare(declarator.id.name, value, isConst)
					result = value
				}
				return result
			}

			case 'AssignmentExpression': {
				const rightValue = evalNode(node.right, env)

				const left = node.left
				if (left.type === 'Identifier') {
					const newValue = mutateValueForAssignment(node.operator, env.get(left.name), rightValue)
					env.assign(left.name, newValue)
					return newValue
				} else if (left.type === 'MemberExpression') {
					const object = evalNode(left.object, env)
					const property = resolveMemberProperty(left, env)
					assertAssignableMember(object, property, 'Assignment to property')

					const newValue = mutateValueForAssignment(node.operator, object[property], rightValue)

					object[property] = newValue
					return newValue
				} else {
					throw new Error(`Cannot assign to an ${left.type}`)
				}
			}

			case 'UpdateExpression': {
				const arg = node.argument
				if (arg.type === 'Identifier') {
					const delta = node.operator === '++' ? 1 : -1
					const oldValue = Number(env.get(arg.name))
					const newValue = oldValue + delta
					env.assign(arg.name, newValue)
					return node.prefix ? newValue : oldValue
				} else if (arg.type === 'MemberExpression') {
					const object = evalNode(arg.object, env)
					const property = resolveMemberProperty(arg, env)
					assertAssignableMember(object, property, 'Update of property')

					switch (node.operator) {
						case '++':
							return node.prefix ? ++object[property] : object[property]++
						case '--':
							return node.prefix ? --object[property] : object[property]--
						default:
							throw new Error(`Unsupported update operator "${node.operator}"`)
					}
				} else {
					throw new Error(`Cannot update ${arg.type}`)
				}
			}

			default:
				throw new Error(`Unknown node "${node.type}"`)
		}
	}

	return evalNode(node, rootEnv)
}

/**
 * Whether `key` is a canonical array index (a non-negative integer below 2^32 - 1 whose string form
 * round-trips). Arrays only allow assignment to indices, never to `length`, methods or other named props.
 */
function isArrayIndex(key: any): boolean {
	const num = typeof key === 'number' ? key : Number(key)
	return Number.isInteger(num) && num >= 0 && num < 4294967295 && String(num) === String(key)
}

/**
 * Guard a member write (`obj.x = ...`, `++obj.x`): reject prototype-related keys, and restrict arrays
 * to integer-index assignment so writes match the (own-enumerable, index-only) read model.
 * `action` is e.g. "Assignment to property" / "Update of property".
 */
function assertAssignableMember(object: any, property: any, action: string): void {
	if (BANNED_PROPS.has(String(property))) throw new Error(`${action} "${property}" is not allowed`)
	if (Array.isArray(object) && !isArrayIndex(property))
		throw new Error(`${action} "${property}" on an array is not allowed`)
}

/**
 * Expand a value used in a spread (`...value`) or iterated in `for...of` into an array of items.
 * Arrays, strings and other iterables are supported; anything else is an error, matching JS.
 */
function spreadIterable(value: any): any[] {
	if (value == null) throw new Error('Cannot spread a null or undefined value')
	if (Array.isArray(value)) return value
	if (typeof value === 'string') return Array.from(value)
	if (typeof value[Symbol.iterator] === 'function') return Array.from(value)
	throw new Error('Spread value is not iterable')
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
