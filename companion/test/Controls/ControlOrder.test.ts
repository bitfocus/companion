import { describe, expect, test, vi } from 'vitest'
import { CreateTriggerControlId } from '@companion-app/shared/ControlId.js'
import { moveControlInCollection, type OrderedControl } from '../../lib/Controls/ControlOrder.js'

function createControl(id: string, sortOrder: number, collectionId?: string) {
	const control = {
		controlId: CreateTriggerControlId(id),
		options: { sortOrder, collectionId } as { sortOrder: number; collectionId?: string },
		optionsSetField: vi.fn((change: { key: 'sortOrder' | 'collectionId'; value: any }) => {
			control.options = { ...control.options, [change.key]: change.value }
			return true
		}),
	}
	return control satisfies OrderedControl
}

/** The ids of the controls in a collection, in order */
function order(controls: ReturnType<typeof createControl>[], collectionId?: string): string[] {
	return controls
		.filter((control) => control.options.collectionId === collectionId)
		.sort((a, b) => a.options.sortOrder - b.options.sortOrder)
		.map((control) => control.controlId)
}

describe('moveControlInCollection', () => {
	test('moves a control within its collection, renumbering the others', () => {
		const controls = [createControl('a', 0), createControl('b', 1), createControl('c', 2)]

		moveControlInCollection(controls, controls[2], null, 0)

		expect(order(controls)).toEqual(['trigger:c', 'trigger:a', 'trigger:b'])
		expect(controls.map((control) => control.options.sortOrder)).toEqual([1, 2, 0])
	})

	test('moves a control into another collection, at the end for a negative index', () => {
		const controls = [createControl('a', 0), createControl('b', 0, 'group'), createControl('c', 1, 'group')]

		moveControlInCollection(controls, controls[0], 'group', -1)

		expect(order(controls, 'group')).toEqual(['trigger:b', 'trigger:c', 'trigger:a'])
		expect(order(controls)).toEqual([])
	})

	test('moves a control out of its collection', () => {
		const controls = [createControl('a', 0, 'group'), createControl('b', 0), createControl('c', 1)]

		moveControlInCollection(controls, controls[0], null, 1)

		expect(controls[0].options.collectionId).toBeUndefined()
		expect(order(controls)).toEqual(['trigger:b', 'trigger:a', 'trigger:c'])
	})

	test('only saves the controls whose position changed', () => {
		const controls = [createControl('a', 0), createControl('b', 1), createControl('c', 2)]

		moveControlInCollection(controls, controls[2], null, 2)

		for (const control of controls) expect(control.optionsSetField).not.toHaveBeenCalled()
	})
})
