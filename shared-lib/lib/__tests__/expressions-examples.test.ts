import { describe, expect, it } from 'vitest'
import { ExpressionFunctions } from '../Expression/ExpressionFunctions.js'
import { ParseExpression } from '../Expression/ExpressionParse.js'
import { ResolveExpression, type GetVariableValueProps } from '../Expression/ExpressionResolve.js'

// Realistic, multi-feature expressions of the kind a user might actually write - combining variables,
// control flow, closures, collection helpers, objects/arrays, templates and optional chaining.

const VARS: Record<string, any> = {
	'custom:cart': [
		{ name: 'Widget', price: 10, qty: 2 },
		{ name: 'Gadget', price: 5, qty: 3 },
		{ name: 'Sprocket', price: 8, qty: 1 },
	],
	'custom:state': 2,
	'custom:scores': [42, 17, 99, 8, 63],
	'custom:config': { servers: [{ name: 'primary' }, { name: 'backup' }] },
	'custom:empty_config': {},
	'mixer:ch1_level': -6.3,
	'player:position': 45,
	'player:duration': 180,
	'internal:operator': undefined,
}
const getVar = (p: GetVariableValueProps): any => VARS[p.variableId]

function run(expr: string): any {
	return ResolveExpression(ParseExpression(expr), getVar, ExpressionFunctions)
}

describe('realistic expression examples', () => {
	it('cart total via reduce over objects', () => {
		// 10*2 + 5*3 + 8*1 = 43
		expect(run('arrayReduce($(custom:cart), (sum, item) => sum + item.price * item.qty, 0)')).toBe(43)
	})

	it('cart total via an explicit loop (same result)', () => {
		const expr = `
			let total = 0
			for (const item of $(custom:cart)) {
				total = total + item.price * item.qty
			}
			total
		`
		expect(run(expr)).toBe(43)
	})

	it('names of items costing more than 8, as a list', () => {
		expect(run('arrayMap(arrayFilter($(custom:cart), item => item.price > 8), item => item.name)')).toEqual(['Widget'])
	})

	it('lookup table keyed by a variable', () => {
		expect(run("{ 1: 'Standby', 2: 'Live', 3: 'Off' }[$(custom:state)]")).toBe('Live')
	})

	it('max score via reduce', () => {
		expect(run('arrayReduce($(custom:scores), (best, x) => x > best ? x : best, 0)')).toBe(99)
	})

	it('count of passing scores', () => {
		expect(run('arrayFilter($(custom:scores), x => x >= 50)')).toEqual([99, 63])
		expect(run('length(arrayFilter($(custom:scores), x => x >= 50))')).toBe(2)
	})

	it('formatted summary string built from structured data', () => {
		// Note the `;` before the template line: without it, `arrayReduce(...) ` followed by a backtick
		// would be parsed as a tagged template literal (a JS ASI hazard).
		const expr = `
			let items = $(custom:cart)
			let total = arrayReduce(items, (sum, item) => sum + item.price * item.qty, 0);
			\`\${length(items)} items, total \${total}\`
		`
		expect(run(expr)).toBe('3 items, total 43')
	})

	it('safe nested access with optional chaining and a fallback', () => {
		expect(run("$(custom:config)?.servers?.[0]?.name ?? 'unknown'")).toBe('primary')
		expect(run("$(custom:empty_config)?.servers?.[0]?.name ?? 'unknown'")).toBe('unknown')
		expect(run("$(missing:thing)?.a?.b ?? 'unknown'")).toBe('unknown')
	})

	it('recursive helper (fibonacci)', () => {
		const expr = `
			let fib = n => n < 2 ? n : fib(n - 1) + fib(n - 2)
			fib(10)
		`
		expect(run(expr)).toBe(55)
	})

	it('classification loop building an array', () => {
		const expr = `
			let out = []
			for (let i = 1; i <= 5; i++) {
				out = [...out, i % 2 === 0 ? 'even' : 'odd']
			}
			out
		`
		expect(run(expr)).toEqual(['odd', 'even', 'odd', 'even', 'odd'])
	})

	it('early return from a search', () => {
		const expr = `
			let findExpensive = items => {
				for (const item of items) {
					if (item.price > 8) {
						return item.name
					}
				}
				return 'none'
			}
			findExpensive($(custom:cart))
		`
		expect(run(expr)).toBe('Widget')
	})

	it('progress percentage as text', () => {
		expect(run('`${round($(player:position) / $(player:duration) * 100)}%`')).toBe('25%')
	})

	it('grouping/counting into an object', () => {
		const expr = `
			let counts = { high: 0, low: 0 }
			for (const score of $(custom:scores)) {
				if (score >= 50) {
					counts.high = counts.high + 1
				} else {
					counts.low = counts.low + 1
				}
			}
			counts
		`
		expect(run(expr)).toEqual({ high: 2, low: 3 })
	})

	it('chained pipeline: filter -> map -> sort -> reduce', () => {
		const expr = `
			let evens = arrayFilter($(custom:scores), x => x % 2 === 0)
			let doubled = arrayMap(evens, x => x * 2)
			let sorted = arraySort(doubled, (a, b) => a - b)
			arrayReduce(sorted, (a, b) => a + b, 0)
		`
		// scores: [42,17,99,8,63] -> evens [42,8] -> doubled [84,16] -> sorted [16,84] -> sum 100
		expect(run(expr)).toBe(100)
	})

	it('memoised-style accumulation across a closure', () => {
		const expr = `
			let makeAdder = base => x => base + x
			let add10 = makeAdder(10)
			arrayMap([1, 2, 3], add10)
		`
		expect(run(expr)).toEqual([11, 12, 13])
	})
})
