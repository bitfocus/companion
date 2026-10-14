import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import { LayeredButtonExtraTabs, useButtonEditorMainTab } from '../useButtonEditorMainTab.js'

const STORAGE_KEY = 'buttonEditor.activeMainTab'

function steps(count: number): NormalButtonSteps {
	return Object.fromEntries(Array.from({ length: count }, (_, i) => [String(i), {}])) as unknown as NormalButtonSteps
}

describe('useButtonEditorMainTab', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('lists Actions before the layered button tabs', () => {
		const { result } = renderHook(() => useButtonEditorMainTab(steps(1), LayeredButtonExtraTabs))

		expect(result.current.tabs.map((tab) => tab.id)).toEqual(['actions', 'style', 'feedbacks', 'variables', 'options'])
		expect(result.current.activeTab).toBe('actions')
	})

	it('counts the steps on the Actions tab only when there are several', () => {
		const { result, rerender } = renderHook(
			({ count }) => useButtonEditorMainTab(steps(count), LayeredButtonExtraTabs),
			{
				initialProps: { count: 1 },
			}
		)
		expect(result.current.tabs[0].count).toBeUndefined()

		rerender({ count: 3 })
		expect(result.current.tabs[0].count).toBe(3)
	})

	it('remembers the selected tab', () => {
		const { result } = renderHook(() => useButtonEditorMainTab(steps(1), LayeredButtonExtraTabs))

		act(() => result.current.setActiveTab('style'))
		expect(result.current.activeTab).toBe('style')
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toBe('style')
	})

	it('falls back to Actions when the remembered tab no longer exists', () => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify('gone'))
		const { result } = renderHook(() => useButtonEditorMainTab(steps(1), LayeredButtonExtraTabs))

		expect(result.current.activeTab).toBe('actions')
	})

	it('has no tabs, and leaves the remembered tab alone, for a button without editor tabs', () => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify('style'))
		const { result } = renderHook(() => useButtonEditorMainTab(null, LayeredButtonExtraTabs))

		expect(result.current.tabs).toEqual([])
		expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toBe('style')
	})
})
