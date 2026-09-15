import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePanelCollapseAccordionProps, usePanelCollapseHelper, type PanelCollapseHelper } from '../CollapseHelper.js'

// In-memory helper (storageId null) so nothing touches localStorage between tests
function setup(sectionIds: string[]) {
	const { result } = renderHook(() => {
		const helper = usePanelCollapseHelper(null, sectionIds)
		const accordion = usePanelCollapseAccordionProps(helper, sectionIds)
		return { helper, accordion }
	})
	return result
}

function altClick(getTriggerProps: (id: string) => { onClickCapture?: React.MouseEventHandler }, sectionId: string) {
	const stopPropagation = vi.fn()
	act(() => {
		getTriggerProps(sectionId).onClickCapture?.({ altKey: true, stopPropagation } as never)
	})
	return stopPropagation
}

const allCollapsed = (helper: PanelCollapseHelper, ids: string[]) =>
	ids.every((id) => helper.isPanelCollapsed(null, id))
const allExpanded = (helper: PanelCollapseHelper, ids: string[]) =>
	ids.every((id) => !helper.isPanelCollapsed(null, id))

describe('usePanelCollapseAccordionProps getTriggerProps (alt+click expand/collapse all)', () => {
	it('alt+click on an expanded section collapses every section', () => {
		const ids = ['a', 'b', 'c']
		const result = setup(ids)

		expect(allExpanded(result.current.helper, ids)).toBe(true)

		const stop = altClick(result.current.accordion.getTriggerProps, 'a')

		expect(stop).toHaveBeenCalled() // took over from base-ui's own single-section toggle
		expect(allCollapsed(result.current.helper, ids)).toBe(true)
	})

	it('alt+click on a collapsed section expands every section', () => {
		const ids = ['a', 'b', 'c']
		const result = setup(ids)

		act(() => result.current.helper.setMultipleCollapsed(ids, true))
		expect(allCollapsed(result.current.helper, ids)).toBe(true)

		altClick(result.current.accordion.getTriggerProps, 'b')

		expect(allExpanded(result.current.helper, ids)).toBe(true)
	})

	it('matches the clicked section state, even when the sections disagree', () => {
		const ids = ['a', 'b', 'c']
		const result = setup(ids)

		// Collapse only 'a'; clicking the still-expanded 'b' should collapse everything
		act(() => result.current.helper.setPanelCollapsed('a', true))

		altClick(result.current.accordion.getTriggerProps, 'b')

		expect(allCollapsed(result.current.helper, ids)).toBe(true)
	})

	it('ignores a plain click so base-ui toggles the single section', () => {
		const ids = ['a', 'b', 'c']
		const result = setup(ids)

		const stopPropagation = vi.fn()
		act(() => {
			result.current.accordion.getTriggerProps('a').onClickCapture?.({ altKey: false, stopPropagation } as never)
		})

		expect(stopPropagation).not.toHaveBeenCalled()
		expect(allExpanded(result.current.helper, ids)).toBe(true)
	})

	it('offers no toggle-all props when there is only one section', () => {
		const result = setup(['only'])

		expect(result.current.accordion.getTriggerProps('only')).toEqual({})
	})
})
