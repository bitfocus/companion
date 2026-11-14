import { describe, expect, test } from 'vitest'
import { MAX_CUSTOM_ACTION_DEPTH } from '../../../lib/Controls/CustomActionRunFrame.js'
import { analyseCustomActionCalls, analyseCustomCalls } from '../../../lib/Controls/CustomActions/CustomActionCalls.js'

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

	test.each([
		['within the limit', MAX_CUSTOM_ACTION_DEPTH, false],
		['beyond the limit', MAX_CUSTOM_ACTION_DEPTH + 1, true],
	])(
		'measures the depth of calls which branch and join again, %s, without trying every path',
		(_name, layers, tooDeep) => {
			// Each custom action calls all of the next layer, so there are 4^layers chains of calls through them
			const width = 4
			const graph: Record<string, string[]> = {}
			for (let layer = 0; layer < layers; layer++) {
				for (let i = 0; i < width; i++) {
					graph[`${layer}-${i}`] =
						layer + 1 < layers ? Array.from({ length: width }, (_, j) => `${layer + 1}-${j}`) : []
				}
			}

			const start = performance.now()
			const result = analyseCustomActionCalls(calls(graph))

			expect(result.get('0-0')!.tooDeep).toBe(tooDeep)
			expect(result.get(`${layers - 1}-0`)!.tooDeep).toBe(false)
			expect(performance.now() - start).toBeLessThan(1000)
		},
		30_000
	)
})

describe('analyseCustomCalls', () => {
	function actions(graph: Record<string, { actions: string[]; feedbacks: string[] }>) {
		return new Map(
			Object.entries(graph).map(([id, called]) => [
				id,
				{ customActionIds: new Set(called.actions), customFeedbackIds: new Set(called.feedbacks) },
			])
		)
	}

	test('a custom action is told only of the custom actions it calls', () => {
		const result = analyseCustomCalls(
			actions({ a: { actions: ['b'], feedbacks: ['x'] }, b: { actions: [], feedbacks: [] } }),
			calls({ x: ['y'], y: [] })
		)

		expect(result.customActions.get('a')).toEqual({ calledIds: new Set(['b']), loop: null, tooDeep: false })
		expect(result.customFeedbacks.get('x')).toEqual({ calledIds: new Set(['y']), loop: null, tooDeep: false })
	})

	test('a custom action and a custom feedback with the same id are not confused', () => {
		const result = analyseCustomCalls(actions({ a: { actions: [], feedbacks: ['a'] } }), calls({ a: [] }))

		expect(result.customActions.get('a')!.loop).toBeNull()
		expect(result.customActions.get('a')!.calledIds).toEqual(new Set())
	})

	test('finds a loop of custom feedbacks, in their own ids', () => {
		const result = analyseCustomCalls(actions({ a: { actions: [], feedbacks: ['x'] } }), calls({ x: ['y'], y: ['x'] }))

		expect(result.customFeedbacks.get('x')!.loop).toEqual(['x', 'y', 'x'])
		// a uses the loop, but isn't part of it
		expect(result.customActions.get('a')!.loop).toBeNull()
	})

	test('the depth of a custom action includes the custom feedbacks it uses', () => {
		// Half of the chain is custom actions, and the rest custom feedbacks, so neither alone is too deep
		const half = MAX_CUSTOM_ACTION_DEPTH / 2
		const actionGraph: Record<string, { actions: string[]; feedbacks: string[] }> = {}
		for (let i = 1; i <= half; i++) {
			actionGraph[`a${i}`] = i < half ? { actions: [`a${i + 1}`], feedbacks: [] } : { actions: [], feedbacks: ['f1'] }
		}
		const feedbackGraph: Record<string, string[]> = {}
		for (let i = 1; i <= half + 1; i++) feedbackGraph[`f${i}`] = i <= half ? [`f${i + 1}`] : []

		const result = analyseCustomCalls(actions(actionGraph), calls(feedbackGraph))

		expect(result.customActions.get('a1')!.tooDeep).toBe(true)
		expect(result.customActions.get('a2')!.tooDeep).toBe(false)
		expect(result.customFeedbacks.get('f1')!.tooDeep).toBe(false)
	})
})
