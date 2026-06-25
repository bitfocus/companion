import { describe, expect, it } from 'vitest'
import { ExpressionFunctions } from '../Expression/ExpressionFunctions.js'
import { ParseExpression } from '../Expression/ExpressionParse.js'
import { ResolveExpression, type GetVariableValueProps } from '../Expression/ExpressionResolve.js'

const noVars = (_p: GetVariableValueProps): undefined => undefined

function run(expr: string, options?: { maxOperations?: number; maxCallDepth?: number }): any {
	return ResolveExpression(ParseExpression(expr), noVars, ExpressionFunctions, options)
}

describe('collection builtins', () => {
	it('arrayMap', () => {
		expect(run('arrayMap([1, 2, 3], x => x * 2)')).toEqual([2, 4, 6])
		expect(run('arrayMap([1, 2, 3], (x, i) => x + i)')).toEqual([1, 3, 5])
	})

	it('arrayFilter', () => {
		expect(run('arrayFilter([1, 2, 3, 4, 5], x => x % 2 === 1)')).toEqual([1, 3, 5])
	})

	it('arrayReduce', () => {
		expect(run('arrayReduce([1, 2, 3, 4], (acc, x) => acc + x, 0)')).toBe(10)
		expect(run('arrayReduce([], (acc, x) => acc + x, 42)')).toBe(42)
	})

	it('arrayForEach (side effects, returns undefined)', () => {
		expect(run('let s = 0; arrayForEach([1, 2, 3], x => { s = s + x }); s')).toBe(6)
		expect(run('arrayForEach([1], x => x)')).toBeUndefined()
	})

	it('arrayFind / arrayFindIndex', () => {
		expect(run('arrayFind([1, 2, 3, 4], x => x > 2)')).toBe(3)
		expect(run('arrayFind([1, 2], x => x > 9)')).toBeUndefined()
		expect(run('arrayFindIndex([1, 2, 3], x => x === 2)')).toBe(1)
		expect(run('arrayFindIndex([1, 2, 3], x => x === 9)')).toBe(-1)
	})

	it('arraySome / arrayEvery', () => {
		expect(run('arraySome([1, 2, 3], x => x > 2)')).toBe(true)
		expect(run('arraySome([1, 2, 3], x => x > 9)')).toBe(false)
		expect(run('arrayEvery([2, 4, 6], x => x % 2 === 0)')).toBe(true)
		expect(run('arrayEvery([2, 4, 5], x => x % 2 === 0)')).toBe(false)
	})

	it('arraySort (optional comparator, returns a copy)', () => {
		expect(run('arraySort([3, 1, 2], (a, b) => a - b)')).toEqual([1, 2, 3])
		expect(run('arraySort([3, 1, 2], (a, b) => b - a)')).toEqual([3, 2, 1])
		// does not mutate the source array
		expect(run('let a = [3, 1, 2]; arraySort(a, (x, y) => x - y); a')).toEqual([3, 1, 2])
	})

	it('arrayReverse / objectKeys / objectValues', () => {
		expect(run('arrayReverse([1, 2, 3])')).toEqual([3, 2, 1])
		expect(run('objectKeys({a: 1, b: 2})')).toEqual(['a', 'b'])
		expect(run('objectValues({a: 1, b: 2})')).toEqual([1, 2])
	})

	it('compose cleanly', () => {
		expect(
			run('arrayReduce(arrayMap(arrayFilter([1, 2, 3, 4, 5], x => x % 2 === 1), x => x * 10), (a, b) => a + b, 0)')
		).toBe(90)
	})

	it('arrow callbacks can reference outer scope', () => {
		expect(run('let factor = 3; arrayMap([1, 2, 3], x => x * factor)')).toEqual([3, 6, 9])
	})

	describe('lenient with non-array / bad input', () => {
		it('returns sensible defaults for non-arrays', () => {
			expect(run('arrayMap(5, x => x)')).toBeUndefined()
			expect(run('arrayFilter(null, x => x)')).toBeUndefined()
			expect(run('arrayFind(undefined, x => x)')).toBeUndefined()
			expect(run('arrayFindIndex(5, x => x)')).toBe(-1)
			expect(run('arraySome(5, x => x)')).toBe(false)
		})

		it('throws when the callback is not a function', () => {
			expect(() => run('arrayMap([1, 2, 3], 5)')).toThrow(/requires a function/)
			expect(() => run('arrayReduce([1, 2, 3], 5, 0)')).toThrow(/requires a function/)
		})
	})

	describe('callbacks are metered by the execution budget', () => {
		it('a callback over an array counts against maxOperations', () => {
			// The array literal is free; each closure invocation ticks once - so 5 invocations
			// exceed a budget of 2
			expect(() => run('arrayMap([1, 2, 3, 4, 5], x => x)', { maxOperations: 2 })).toThrow(
				/maximum number of operations/
			)
			// ...and fits within a sufficient budget
			expect(run('arrayMap([1, 2, 3, 4, 5], x => x)', { maxOperations: 5 })).toEqual([1, 2, 3, 4, 5])
		})
	})
})
