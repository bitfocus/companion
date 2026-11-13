import { EventEmitter } from 'node:events'
import { describe, expect, test, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import { CreateBankControlId, CreateTriggerControlId } from '@companion-app/shared/ControlId.js'
import { ControlsController } from '../../lib/Controls/Controller.js'
import type { ControlStore } from '../../lib/Controls/ControlStore.js'

function createController() {
	const controls = new Map<string, any>()
	const store = mockDeep<ControlStore>()
	;(store as any).controls = controls

	// The collections controllers read their table on construction
	const db = { getSchemaTableView: vi.fn(() => mockDeep<any>({ tableName: 'mock', all: () => ({}) } as any)) } as any

	const controller = new ControlsController(
		db,
		store,
		new EventEmitter() as any,
		mockDeep<any>(), // activeLearningStore
		mockDeep<any>() // controlDeps
	)

	return { controller, controls }
}

describe('ControlsController.subscribeAll', () => {
	test('subscribes every entity of every control that has them', () => {
		const { controller, controls } = createController()

		const withEntities = { supportsEntities: true, entities: { resubscribeEntities: vi.fn() } }
		const withoutEntities = { supportsEntities: false, entities: { resubscribeEntities: vi.fn() } }
		controls.set(CreateBankControlId('a'), withEntities)
		controls.set(CreateTriggerControlId('b'), withoutEntities)

		controller.subscribeAll()

		// Unfiltered: module, internal and special expression side effects all need applying at startup
		expect(withEntities.entities.resubscribeEntities).toHaveBeenCalledTimes(1)
		expect(withEntities.entities.resubscribeEntities).toHaveBeenCalledWith()
		expect(withoutEntities.entities.resubscribeEntities).not.toHaveBeenCalled()
	})
})
