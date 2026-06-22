import { describe, expect, it } from 'vitest'
import { ExpressionFunctions } from '../Expression/ExpressionFunctions.js'
import { ParseExpression } from '../Expression/ExpressionParse.js'
import { ResolveExpression, type GetVariableValueProps } from '../Expression/ExpressionResolve.js'

/**
 * Sandbox guarantees for the expression evaluator.
 *
 * A user-authored expression must not be able to:
 *  - reach a prototype (`__proto__`, `constructor`, `prototype`, ...) for read, write, or via an object literal
 *  - pollute the global `Object.prototype`
 *  - reach inherited/built-in members or methods (`toString`, `valueOf`, ...)
 *  - invoke anything other than the explicitly provided builtin functions
 *  - reach host globals (`globalThis`, `process`, `require`, `Function`, ...)
 */

const getVar = (p: GetVariableValueProps): any => {
	// A variable whose value is hostile JSON containing a `__proto__` own key
	if (p.variableId === 'evil:obj') return JSON.parse('{"__proto__": {"polluted": true}, "a": 1}')
	return undefined
}

function evaluate(expr: string): unknown {
	return ResolveExpression(ParseExpression(expr), getVar, ExpressionFunctions)
}

function evalResult(expr: string): { ok: true; value: unknown } | { ok: false; error: string } {
	try {
		return { ok: true, value: evaluate(expr) }
	} catch (e) {
		return { ok: false, error: (e as Error).message }
	}
}

describe('expression sandbox', () => {
	describe('prototype access is blocked', () => {
		const blocked = [
			'a = {}; a.constructor',
			"a = {}; a['constructor']",
			'[].constructor',
			"''.constructor",
			'(5).constructor',
			'PI.constructor',
			'a = {}; a.__proto__',
			"a = {}; a['__proto__']",
			'$(evil:obj).__proto__',
			'a = {}; a.prototype',
			'a = {}; a.__defineGetter__',
		]
		for (const expr of blocked) {
			it(`throws for: ${JSON.stringify(expr)}`, () => {
				expect(evalResult(expr).ok).toBe(false)
			})
		}
	})

	describe('prototype write/assignment is blocked', () => {
		const blocked = [
			'a = {}; a.__proto__ = {x: 1}',
			"a = {}; a['__proto__'] = {x: 1}",
			'a = {}; a.constructor = 1',
			'a = {}; ++a.__proto__',
		]
		for (const expr of blocked) {
			it(`throws for: ${JSON.stringify(expr)}`, () => {
				expect(evalResult(expr).ok).toBe(false)
			})
		}
	})

	describe('object literals cannot set a prototype', () => {
		const blocked = ['{__proto__: {x: 1}}', "{['__proto__']: {x: 1}}", '{constructor: 1}', '{__proto__: {x: 1}}.x']
		for (const expr of blocked) {
			it(`throws for: ${JSON.stringify(expr)}`, () => {
				expect(evalResult(expr).ok).toBe(false)
			})
		}
	})

	it('does not pollute the global Object.prototype', () => {
		// Try a range of pollution attempts; none should affect a fresh object
		evalResult('{__proto__: {polluted: 1}}')
		evalResult('a = {}; a.__proto__ = {polluted: 1}')
		evalResult('{...$(evil:obj)}')
		evalResult("a = {}; a['__proto__'] = {polluted: 1}")
		expect(({} as Record<string, unknown>).polluted).toBeUndefined()
	})

	describe('inherited members are not readable', () => {
		it('returns undefined for built-in methods', () => {
			expect(evaluate('a = {}; a.toString')).toBeUndefined()
			expect(evaluate('a = {}; a.valueOf')).toBeUndefined()
			expect(evaluate('a = {}; a.hasOwnProperty')).toBeUndefined()
			expect(evaluate('[1,2,3].map')).toBeUndefined()
			expect(evaluate('[1,2,3].length')).toBeUndefined()
		})
	})

	describe('object spread cannot smuggle a prototype', () => {
		it('drops a hostile __proto__ key and keeps real data', () => {
			expect(evaluate('{...$(evil:obj)}')).toEqual({ a: 1 })
		})
	})

	describe('only provided builtins are callable', () => {
		const blocked = [
			'constructor()',
			'constructor(5)',
			'toString()',
			'valueOf()',
			'hasOwnProperty("x")',
			'__defineGetter__("x", 1)',
			'isPrototypeOf({})',
			'propertyIsEnumerable("x")',
		]
		for (const expr of blocked) {
			it(`rejects inherited method call: ${JSON.stringify(expr)}`, () => {
				const result = evalResult(expr)
				expect(result.ok).toBe(false)
				if (!result.ok) expect(result.error).toMatch(/Unsupported function/)
			})
		}

		it('a real builtin still works', () => {
			expect(evaluate('round(1.4)')).toBe(1)
		})
	})

	describe('host globals are not reachable', () => {
		it('global identifiers resolve to undefined (and are not callable)', () => {
			for (const name of ['globalThis', 'process', 'require', 'Function', 'eval', 'global', 'Object', 'Array']) {
				expect(evaluate(name)).toBeUndefined()
				expect(evalResult(`${name}('x')`).ok).toBe(false)
			}
		})
	})

	describe('arrays only allow integer-index access (read and write)', () => {
		it('blocks reads of non-index array properties', () => {
			expect(evaluate('[1, 2, 3].length')).toBeUndefined()
			expect(evaluate("[1, 2, 3]['foo']")).toBeUndefined()
		})

		it('blocks writes to non-index array properties', () => {
			expect(evalResult('a = [1, 2, 3]; a.length = 0; a').ok).toBe(false)
			expect(evalResult("a = [1, 2, 3]; a['length'] = 0").ok).toBe(false)
			expect(evalResult('a = [1, 2, 3]; a.foo = 9').ok).toBe(false)
			expect(evalResult('a = [1, 2, 3]; a[-1] = 9').ok).toBe(false)
			expect(evalResult('a = [1, 2, 3]; a[1.5] = 9').ok).toBe(false)
			expect(evalResult('a = [1, 2, 3]; ++a.length').ok).toBe(false)
		})

		it('still allows integer index writes (incl. extending)', () => {
			expect(evaluate('a = [1, 2, 3]; a[1] = 9; a')).toEqual([1, 9, 3])
			expect(evaluate('a = [1, 2, 3]; a[5] = 9; a[5]')).toBe(9)
			expect(evaluate('a = [1, 2, 3]; ++a[0]; a[0]')).toBe(2)
		})

		it('object property writes are unaffected (objects are key/value maps)', () => {
			expect(evaluate('a = {}; a.foo = 1; a.foo')).toBe(1)
			expect(evaluate("a = {}; a['x'] = 2; a")).toEqual({ x: 2 })
		})
	})

	describe('variable values are isolated (cloned per read)', () => {
		it('mutating a value read from a variable does not affect the source', () => {
			const source = [1, 2, 3]
			const getValue = (p: GetVariableValueProps): any => (p.variableId === 'my:arr' ? source : undefined)
			const result = ResolveExpression(ParseExpression('a = $(my:arr); a[0] = 99; a'), getValue, ExpressionFunctions)
			expect(result).toEqual([99, 2, 3])
			expect(source).toEqual([1, 2, 3])
		})
	})
})
