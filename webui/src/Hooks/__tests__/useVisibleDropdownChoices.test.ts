import { renderHook } from '@testing-library/react'
import { observable, runInAction } from 'mobx'
import { describe, expect, it } from 'vitest'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import { exprVal, type ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'
import { useVisibleDropdownChoices } from '../useVisibleDropdownChoices.js'

const choices: DropdownChoice[] = [
	{ id: 'camera', label: 'Camera', isVisibleExpression: '$(options:scene) == "Live"' },
	{ id: 2, label: 'Slides', isVisibleExpression: '$(options:scene) == "Slides"' },
	{ id: 'always', label: 'Always' },
]

describe('useVisibleDropdownChoices', () => {
	it('updates with literal sibling values without changing saved selections', () => {
		const options = observable<ExpressionableOptionsObject>({ scene: exprVal('Live'), source: exprVal(2) })
		const { result, rerender } = renderHook(() => useVisibleDropdownChoices(choices, options))
		expect(result.current.map((choice) => choice.id)).toEqual(['camera', 'always'])
		runInAction(() => {
			options.scene = exprVal('Slides')
		})
		rerender()
		expect(result.current.map((choice) => choice.id)).toEqual([2, 'always'])
		expect(options.source).toEqual(exprVal(2))
	})

	it('retains all choices when a sibling is missing or in expression mode', () => {
		const { result, rerender } = renderHook(({ options }) => useVisibleDropdownChoices(choices, options), {
			initialProps: { options: {} },
		})
		expect(result.current).toEqual(choices)
		rerender({ options: { scene: { isExpression: true, value: '"Live"' } } })
		expect(result.current).toEqual(choices)
	})

	it('fails open on invalid expressions', () => {
		const invalid = [{ id: 'broken', label: 'Broken', isVisibleExpression: '(' }]
		const { result } = renderHook(() => useVisibleDropdownChoices(invalid, {}))
		expect(result.current).toEqual(invalid)
	})

	it('supports scene membership expressions and target guards', () => {
		const scoped = [
			{
				id: 'camera',
				label: 'Camera',
				isVisibleExpression: `$(options:target) != 'scene' || !arrayIncludes(["Live", "Empty"], $(options:scene)) || arrayIncludes(["Live"], $(options:scene))`,
			},
		]
		const { result, rerender } = renderHook(
			({ scene, target }) =>
				useVisibleDropdownChoices(scoped, {
					scene: exprVal(scene),
					target: exprVal(target),
				}),
			{ initialProps: { scene: 'Empty', target: 'scene' } }
		)
		expect(result.current).toEqual([])
		rerender({ scene: 'Live', target: 'scene' })
		expect(result.current).toEqual(scoped)
		rerender({ scene: 'Missing', target: 'scene' })
		expect(result.current).toEqual(scoped)
		rerender({ scene: 'Empty', target: 'allScenes' })
		expect(result.current).toEqual(scoped)
	})
})
