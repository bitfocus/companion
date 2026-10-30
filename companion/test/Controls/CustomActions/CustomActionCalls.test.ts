import { describe, expect, test } from 'vitest'
import { MAX_CUSTOM_ACTION_DEPTH } from '../../../lib/Controls/CustomActionRunFrame.js'
import { analyseCustomActionCalls } from '../../../lib/Controls/CustomActions/CustomActionCalls.js'

function calls(graph: Record<string, string[]>) {
	return new Map(Object.entries(graph).map(([id, called]) => [id, new Set(called)]))
}

describe('analyseCustomActionCalls', () => {
	test('a custom action which calls nothing', () => {
		expect(analyseCustomActionCalls(calls({ a: [] })).get('a')).toEqual({
			calledIds: new Set(),
			loop: null,
			tooDeep: false,
		})
	})

	test('finds what is called directly and through others', () => {
		const result = analyseCustomActionCalls(calls({ a: ['b'], b: ['c'], c: [], d: ['c'] }))

		expect(result.get('a')!.calledIds).toEqual(new Set(['b', 'c']))
		expect(result.get('b')!.calledIds).toEqual(new Set(['c']))
		expect(result.get('d')!.calledIds).toEqual(new Set(['c']))
		expect([...result.values()].every((analysis) => analysis.loop === null)).toBe(true)
	})

	test('finds a loop back to itself, through others', () => {
		const result = analyseCustomActionCalls(calls({ a: ['b'], b: ['c'], c: ['a'], d: ['a'] }))

		expect(result.get('a')!.loop).toEqual(['a', 'b', 'c', 'a'])
		expect(result.get('b')!.loop).toEqual(['b', 'c', 'a', 'b'])
		// d calls into the loop, but isn't part of it
		expect(result.get('d')!.loop).toBeNull()
		expect(result.get('d')!.calledIds).toEqual(new Set(['a', 'b', 'c']))
	})

	test('finds a custom action which calls itself', () => {
		expect(analyseCustomActionCalls(calls({ a: ['a'] })).get('a')!.loop).toEqual(['a', 'a'])
	})

	test('ignores calls to custom actions which do not exist', () => {
		const result = analyseCustomActionCalls(calls({ a: ['gone'] }))

		expect(result.get('a')).toEqual({ calledIds: new Set(['gone']), loop: null, tooDeep: false })
	})

	test('finds a chain of calls nested too deeply', () => {
		const graph: Record<string, string[]> = {}
		for (let i = 1; i <= MAX_CUSTOM_ACTION_DEPTH + 1; i++)
			graph[`l${i}`] = i <= MAX_CUSTOM_ACTION_DEPTH ? [`l${i + 1}`] : []

		const result = analyseCustomActionCalls(calls(graph))

		// The first is the one too many, the second is right at the limit
		expect(result.get('l1')!.tooDeep).toBe(true)
		expect(result.get('l2')!.tooDeep).toBe(false)
	})
})
