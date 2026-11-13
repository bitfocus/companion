import { describe, expect, test } from 'vitest'
import {
	CreateBankControlId,
	CreateCustomActionControlId,
	CreateCustomFeedbackControlId,
	CreateExpressionVariableControlId,
	CreateTriggerControlId,
} from '@companion-app/shared/ControlId.js'
import { CustomActionsListStore } from '~/Stores/CustomActionsListStore.js'
import { CustomFeedbacksListStore } from '~/Stores/CustomFeedbacksListStore.js'
import { PagesStore } from '~/Stores/PagesStore.js'
import { TriggersListStore } from '~/Stores/TriggersListStore.js'
import { describeUseControl, formatElapsed, type UseControlStores } from '../UsesDescription.js'

const placedButton = CreateBankControlId('placed')

function createStores(): UseControlStores {
	const pages = new PagesStore()
	pages.updateStore({
		type: 'init',
		order: ['first', 'second'],
		pages: {
			first: { id: 'first', name: 'First', controls: {} },
			second: { id: 'second', name: 'Second', controls: { 1: { 4: placedButton } } },
		},
	})

	const triggersList = new TriggersListStore()
	triggersList.triggers.set(CreateTriggerControlId('named'), { name: 'Morning' } as any)
	triggersList.triggers.set(CreateTriggerControlId('unnamed'), { name: '' } as any)

	const customActionsList = new CustomActionsListStore()
	customActionsList.customActions.set(CreateCustomActionControlId('outer'), { name: 'Outer' } as any)

	const customFeedbacksList = new CustomFeedbacksListStore()
	customFeedbacksList.customFeedbacks.set(CreateCustomFeedbackControlId('inner'), { name: 'Inner' } as any)

	return { pages, triggersList, customActionsList, customFeedbacksList }
}

describe('describeUseControl', () => {
	test('a button is described by where it is', () => {
		// It can only be found by its page
		expect(describeUseControl(placedButton, createStores())).toEqual({
			kind: 'Button',
			name: '2/1/4',
			link: { type: 'buttons-page', pageNumber: 2 },
		})
	})

	test('a button which is not on a page says so', () => {
		expect(describeUseControl(CreateBankControlId('loose'), createStores())).toEqual({
			kind: 'Button',
			name: 'Not on a page',
			link: null,
		})
	})

	test('a button is found where it has moved to', () => {
		const stores = createStores()
		stores.pages.updateStore({
			type: 'update',
			changes: [
				{ id: 'second', name: null, controls: [{ row: 1, column: 4, controlId: null }] },
				{ id: 'first', name: null, controls: [{ row: 0, column: 0, controlId: placedButton }] },
			],
			added: [],
			updatedOrder: null,
		})

		expect(describeUseControl(placedButton, stores)).toEqual({
			kind: 'Button',
			name: '1/0/0',
			link: { type: 'buttons-page', pageNumber: 1 },
		})
	})

	test('a trigger or custom action is described by its name', () => {
		const stores = createStores()
		expect(describeUseControl(CreateTriggerControlId('named'), stores)).toEqual({
			kind: 'Trigger',
			name: 'Morning',
			link: { type: 'trigger', triggerId: 'named' },
		})
		expect(describeUseControl(CreateTriggerControlId('unnamed'), stores)).toEqual({
			kind: 'Trigger',
			name: 'Unnamed trigger',
			link: { type: 'trigger', triggerId: 'unnamed' },
		})
		expect(describeUseControl(CreateCustomActionControlId('outer'), stores)).toEqual({
			kind: 'Custom action',
			name: 'Outer',
			link: { type: 'custom-action', customActionId: 'outer' },
		})
	})

	test('a custom feedback is described by its name', () => {
		expect(describeUseControl(CreateCustomFeedbackControlId('inner'), createStores())).toEqual({
			kind: 'Custom feedback',
			name: 'Inner',
			link: { type: 'custom-feedback', customFeedbackId: 'inner' },
		})
	})

	test('any other control is described by its id', () => {
		const controlId = CreateExpressionVariableControlId('x')
		expect(describeUseControl(controlId, createStores())).toEqual({ kind: 'Control', name: controlId, link: null })
	})
})

describe('formatElapsed', () => {
	test.each([
		[0, '0s'],
		[999, '0s'],
		[45_000, '45s'],
		[185_000, '3m 05s'],
		[3_720_000, '1h 02m'],
		[-5, '0s'],
	])('%d ms is %s', (ms, expected) => {
		expect(formatElapsed(ms)).toBe(expected)
	})
})
