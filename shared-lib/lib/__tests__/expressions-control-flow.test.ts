import { describe, expect, it } from 'vitest'
import { ParseExpression } from '../Expression/ExpressionParse.js'
import { ResolveExpression, type GetVariableValueProps } from '../Expression/ExpressionResolve.js'

const noVars = (_p: GetVariableValueProps): undefined => undefined

function run(expr: string, fns: Record<string, (...a: any[]) => any> = {}): any {
	return ResolveExpression(ParseExpression(expr), noVars, fns)
}

function runWithOptions(expr: string, options: { maxOperations?: number; maxCallDepth?: number }): any {
	return ResolveExpression(ParseExpression(expr), noVars, {}, options)
}

// Collects closures and invokes them - used to observe what loop closures captured
const callAll = { callAll: (fns: Array<() => any>) => fns.map((f) => f()) }

describe('control flow', () => {
	describe('if / else', () => {
		it('runs the taken branch', () => {
			expect(run('let r = 0; if (1 > 0) { r = 1 } else { r = 2 }; r')).toBe(1)
			expect(run('let r = 0; if (1 < 0) { r = 1 } else { r = 2 }; r')).toBe(2)
		})

		it('uses JS truthiness', () => {
			expect(run("let r = 'x'; if ('') { r = 'a' } else { r = 'b' }; r")).toBe('b')
			expect(run("let r = ''; if ('hi') { r = 'a' } else { r = 'b' }; r")).toBe('a')
			expect(run('let r = 0; if (0) { r = 1 }; r')).toBe(0)
		})

		it('supports else-if chains and missing else', () => {
			expect(run('let r = 0; if (false) { r = 1 } else if (true) { r = 2 } else { r = 3 }; r')).toBe(2)
			expect(run('let r = 9; if (false) { r = 1 }; r')).toBe(9)
		})

		it('a bare if statement evaluates to undefined', () => {
			expect(run('if (true) { 5 }')).toBeUndefined()
		})
	})

	describe('while', () => {
		it('loops until the condition is false', () => {
			expect(run('let i = 0; let s = 0; while (i < 5) { s = s + i; i = i + 1 }; s')).toBe(10)
		})

		it('break exits the loop', () => {
			expect(run('let i = 0; while (true) { if (i === 3) { break }; i = i + 1 }; i')).toBe(3)
		})

		it('continue skips to the next iteration', () => {
			expect(run('let i = 0; let s = 0; while (i < 5) { i = i + 1; if (i === 3) { continue }; s = s + i }; s')).toBe(
				1 + 2 + 4 + 5
			)
		})
	})

	describe('for', () => {
		it('classic counting loop with i++', () => {
			expect(run('let s = 0; for (let i = 0; i < 4; i++) { s = s + i }; s')).toBe(6)
		})

		it('break and continue', () => {
			expect(run('let s = 0; for (let i = 0; i < 10; i++) { if (i === 5) { break }; s = s + i }; s')).toBe(10)
			expect(run('let s = 0; for (let i = 0; i < 5; i++) { if (i === 2) { continue }; s = s + i }; s')).toBe(
				0 + 1 + 3 + 4
			)
		})

		it('loop variable is scoped to the loop', () => {
			expect(run('for (let i = 0; i < 3; i++) { i }; i')).toBeUndefined()
		})
	})

	describe('for...of', () => {
		it('iterates arrays', () => {
			expect(run('let s = 0; for (const x of [1, 2, 3]) { s = s + x }; s')).toBe(6)
		})

		it('iterates strings', () => {
			// Note: `+` is numeric-only in this dialect, so string building uses template literals
			expect(run("let s = ''; for (const c of 'abc') { s = `${c}${s}` }; s")).toBe('cba')
		})

		it('break and continue', () => {
			expect(run('let s = 0; for (const x of [1, 2, 3, 4]) { if (x === 3) { break }; s = s + x }; s')).toBe(3)
			expect(run('let s = 0; for (const x of [1, 2, 3, 4]) { if (x === 2) { continue }; s = s + x }; s')).toBe(
				1 + 3 + 4
			)
		})

		it('throws when the right-hand side is not iterable', () => {
			expect(() => run('for (const x of 5) { x }')).toThrow(/not iterable/)
			expect(() => run('for (const x of null) { x }')).toThrow(/null or undefined/)
		})
	})

	describe('result value', () => {
		it('is undefined when the script ends in a control-flow statement', () => {
			expect(run('for (const x of [1, 2, 3]) { x }')).toBeUndefined()
			expect(run('let x = 1; while (x < 3) { x = x + 1 }')).toBeUndefined()
		})

		it('is the trailing expression value when present', () => {
			expect(run('let s = 0; for (const x of [1, 2, 3]) { s = s + x }; s')).toBe(6)
		})
	})
})

describe('scoping', () => {
	it('bare assignment mutates an existing outer binding', () => {
		expect(run("let a = 'outer'; if (true) { a = 'inner' }; a")).toBe('inner')
	})

	it('let shadows an outer binding inside a block', () => {
		expect(run("let a = 'outer'; if (true) { let a = 'inner'; a }; a")).toBe('outer')
	})

	it('a name first touched (bare) inside a block stays block-local', () => {
		expect(run('if (true) { y = 5 }; y')).toBeUndefined()
	})

	it('accumulator declared above the loop works', () => {
		expect(run('total = 0; for (const x of [10, 20, 30]) { total = total + x }; total')).toBe(60)
	})

	it('const reassignment throws', () => {
		expect(() => run('const a = 1; a = 2')).toThrow(/constant/)
	})

	it('let redeclaration in the same scope throws', () => {
		expect(() => run('let a = 1; let a = 2')).toThrow(/already been declared/)
	})

	it('reading an undeclared identifier is undefined (not an error)', () => {
		expect(run('nope')).toBeUndefined()
	})
})

describe('arrow functions and closures', () => {
	it('expression body', () => {
		expect(run('let f = x => x + 1; f(10)')).toBe(11)
		expect(run('let add = (a, b) => a + b; add(2, 3)')).toBe(5)
	})

	it('block body with return', () => {
		expect(run('let f = x => { let y = x * 2; return y + 1 }; f(5)')).toBe(11)
	})

	it('block body without return yields undefined', () => {
		expect(run('let f = x => { x + 1 }; f(5)')).toBeUndefined()
	})

	it('captures the defining environment (by reference)', () => {
		expect(run('let x = 10; let f = () => x; x = 20; f()')).toBe(20)
		expect(run('let make = a => () => a; let g = make(7); g()')).toBe(7)
	})

	it('supports recursion', () => {
		expect(run('let fact = n => n <= 1 ? 1 : n * fact(n - 1); fact(5)')).toBe(120)
	})

	it('can be passed to a builtin that invokes it', () => {
		const fns = {
			mapArr: (arr: any[], fn: (x: any) => any) => arr.map(fn),
			reduceArr: (arr: any[], fn: (acc: any, x: any) => any, init: any) => arr.reduce(fn, init),
		}
		expect(run('mapArr([1, 2, 3], x => x * 2)', fns)).toEqual([2, 4, 6])
		expect(run('reduceArr([1, 2, 3, 4], (a, b) => a + b, 0)', fns)).toBe(10)
	})

	it('a scoped function shadows a builtin of the same name', () => {
		expect(run('let round = x => x + 100; round(1)', { round: (x: number) => Math.round(x) })).toBe(101)
	})

	it('return inside a loop inside a function exits the function', () => {
		expect(
			run("let f = () => { for (const x of [1, 2, 3]) { if (x === 2) { return 'hit' } }; return 'miss' }; f()")
		).toBe('hit')
	})
})

describe('execution budget', () => {
	it('aborts an infinite loop', () => {
		expect(() => run('while (true) { 1 }')).toThrow(/maximum number of operations/)
	})

	it('aborts unbounded recursion with a call-depth error', () => {
		expect(() => run('let f = n => f(n); f(1)')).toThrow(/maximum call depth/)
	})

	it('allows a large-but-bounded loop', () => {
		expect(run('let s = 0; for (let i = 0; i < 10000; i++) { s = s + 1 }; s')).toBe(10000)
	})

	it('the abort cannot be produced as a normal value (it is thrown, not returned)', () => {
		// A script that would loop forever never yields a value
		expect(() => run('let r = 0; while (true) { r = r + 1 }; r')).toThrow(/maximum number of operations/)
	})
})

describe('per-iteration loop scoping', () => {
	it('classic for(let) gives each iteration its own binding (closures capture per-iteration value)', () => {
		expect(run('let fns = []; for (let i = 0; i < 3; i++) { fns = [...fns, () => i] }; callAll(fns)', callAll)).toEqual(
			[0, 1, 2]
		)
	})

	it('for...of gives each iteration its own binding', () => {
		expect(
			run('let fns = []; for (const x of [10, 20, 30]) { fns = [...fns, () => x] }; callAll(fns)', callAll)
		).toEqual([10, 20, 30])
	})

	it('a const loop variable cannot be reassigned by the update', () => {
		expect(() => run('for (const i = 0; i < 3; i++) { i }')).toThrow(/constant/)
	})
})

describe('configurable execution budget', () => {
	it('a lower operation limit aborts a loop the default would allow', () => {
		// Fine under the default budget...
		expect(run('let s = 0; for (let i = 0; i < 1000; i++) { s = s + 1 }; s')).toBe(1000)
		// ...but aborts with a tight limit
		expect(() =>
			runWithOptions('let s = 0; for (let i = 0; i < 1000; i++) { s = s + 1 }; s', { maxOperations: 100 })
		).toThrow(/maximum number of operations/)
	})

	it('a lower call-depth limit aborts recursion the default would allow', () => {
		// 50-deep recursion is fine by default
		expect(run('let f = n => n <= 0 ? 0 : f(n - 1); f(50)')).toBe(0)
		// ...but not with a shallow limit
		expect(() => runWithOptions('let f = n => n <= 0 ? 0 : f(n - 1); f(50)', { maxCallDepth: 10 })).toThrow(
			/maximum call depth/
		)
	})
})

describe('budget boundaries (stupidly low limits)', () => {
	it('maxOperations counts loop iterations exactly', () => {
		// One iteration fits in a budget of 1...
		expect(runWithOptions('let s = 0; for (let i = 0; i < 1; i++) { s = s + 1 }; s', { maxOperations: 1 })).toBe(1)
		// ...a second iteration does not
		expect(() => runWithOptions('for (let i = 0; i < 2; i++) { 1 }', { maxOperations: 1 })).toThrow(
			/maximum number of operations/
		)
	})

	it('a zero operation budget aborts the first loop iteration', () => {
		expect(() => runWithOptions('for (let i = 0; i < 1; i++) { 1 }', { maxOperations: 0 })).toThrow(
			/maximum number of operations/
		)
		// ...but a loop that never iterates costs nothing
		expect(runWithOptions('while (false) { 1 }', { maxOperations: 0 })).toBeUndefined()
		expect(runWithOptions('1 + 2', { maxOperations: 0 })).toBe(3)
	})

	it('maxOperations also counts function calls', () => {
		expect(() => runWithOptions('let f = () => 1; f()', { maxOperations: 0 })).toThrow(/maximum number of operations/)
		expect(runWithOptions('let f = () => 1; f()', { maxOperations: 1 })).toBe(1)
	})

	it('maxCallDepth limits nesting exactly', () => {
		// One level of call is allowed at depth 1...
		expect(runWithOptions('let f = () => 1; f()', { maxCallDepth: 1 })).toBe(1)
		// ...a nested call is not
		expect(() => runWithOptions('let f = () => 1; let g = () => f(); g()', { maxCallDepth: 1 })).toThrow(
			/maximum call depth/
		)
	})

	it('a zero call-depth budget aborts any call', () => {
		expect(() => runWithOptions('let f = () => 1; f()', { maxCallDepth: 0 })).toThrow(/maximum call depth/)
	})

	it('the budget is per-evaluation (a tight limit does not leak between calls)', () => {
		const expr = 'let s = 0; for (let i = 0; i < 5; i++) { s = s + 1 }; s'
		expect(runWithOptions(expr, { maxOperations: 5 })).toBe(5)
		expect(runWithOptions(expr, { maxOperations: 5 })).toBe(5)
	})
})
