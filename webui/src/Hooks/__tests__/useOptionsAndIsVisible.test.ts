import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
	exprVal,
	type ExpressionableOptionsObject,
	type SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import { useOptionsVisibility } from '../useOptionsAndIsVisible.js'

function dropdown(id: string, extra: Partial<SomeCompanionInputField> = {}): SomeCompanionInputField {
	return {
		id,
		type: 'dropdown',
		label: id,
		default: 'a',
		choices: [
			{ id: 'a', label: 'A' },
			{ id: 'b', label: 'B' },
		],
		...extra,
	} as SomeCompanionInputField
}

describe('useOptionsVisibility', () => {
	it('gives a function every option, as a 1.x module expects', () => {
		const options = [
			dropdown('mode', { disableAutoExpression: true }),
			dropdown('level', {
				disableAutoExpression: true,
				isVisibleUi: { type: 'function', fn: '(options) => options.mode === "b"', data: undefined },
			}),
		]

		const initialValues: ExpressionableOptionsObject = { mode: exprVal('a'), level: exprVal('a') }
		const { result, rerender } = renderHook(({ values }) => useOptionsVisibility(options, values), {
			initialProps: { values: initialValues },
		})
		expect(result.current.get('level')).toBe(false)

		rerender({ values: { mode: exprVal('b'), level: exprVal('a') } })
		expect(result.current.get('level')).toBe(true)
	})

	it('lets an expression read an option which is always a plain value', () => {
		const options = [
			dropdown('mode', { disableAutoExpression: true }),
			dropdown('level', { isVisibleUi: { type: 'expression', fn: '$(options:mode) == "b"', data: undefined } }),
		]

		const { result } = renderHook(() => useOptionsVisibility(options, { mode: exprVal('b'), level: exprVal('a') }))

		expect(result.current.get('level')).toBe(true)
	})

	it('does not let an expression read an option which can be an expression', () => {
		const options = [
			dropdown('mode'),
			dropdown('level', { isVisibleUi: { type: 'expression', fn: '$(options:mode) == "b"', data: undefined } }),
		]

		const { result } = renderHook(() => useOptionsVisibility(options, { mode: exprVal('a'), level: exprVal('a') }))

		// Reading `mode` would hide it, but it can't be checked, so it stays shown
		expect(result.current.get('level')).toBe(true)
	})

	it('has nothing to say without any values', () => {
		const options = [dropdown('level', { isVisibleUi: { type: 'function', fn: '() => false', data: undefined } })]

		const { result } = renderHook(() => useOptionsVisibility(options, undefined))

		expect(result.current.size).toBe(0)
	})
})
