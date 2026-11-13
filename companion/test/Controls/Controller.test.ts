import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import {
	CreateBankControlId,
	CreateCustomActionControlId,
	CreateExpressionVariableControlId,
	CreateTriggerControlId,
} from '@companion-app/shared/ControlId.js'
import { ControlsController } from '../../lib/Controls/Controller.js'
import type { ControlStore } from '../../lib/Controls/ControlStore.js'
import { ExpressionVariableNameMap } from '../../lib/Controls/ExpressionVariableNameMap.js'
import { ControlsFactory } from '../../lib/Controls/Factory.js'

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

	return { controller, controls, store }
}

/** A stand-in for the control the factory creates, recording whether it was stored when postProcessImport ran */
function fakeImportedControl(controls: Map<string, any>, controlId: string) {
	const control = {
		controlId,
		options: { variableName: 'v' },
		supportsEntities: true,
		triggerLocationHasChanged: vi.fn(),
		commitChange: vi.fn(),
		storedWhenPostProcessed: undefined as boolean | undefined,
		postProcessImport: vi.fn(() => {
			control.storedWhenPostProcessed = controls.get(controlId) === control
		}),
	}
	vi.spyOn(ControlsFactory.prototype, 'createClassForControl').mockReturnValueOnce(control as any)
	return control
}

afterEach(() => {
	vi.restoreAllMocks()
})

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

describe('importing controls', () => {
	test('importTrigger post-processes the control once it is stored', () => {
		const { controller, controls } = createController()
		const controlId = CreateTriggerControlId('t1')
		const control = fakeImportedControl(controls, controlId)

		controller.importTrigger(controlId, {} as any)

		expect(control.postProcessImport).toHaveBeenCalledTimes(1)
		expect(control.storedWhenPostProcessed).toBe(true)
	})

	test('importExpressionVariable post-processes the control once it is stored and its name is registered', () => {
		const { controller, controls } = createController()
		const controlId = CreateExpressionVariableControlId('e1')
		const control = fakeImportedControl(controls, controlId)
		const addName = vi.spyOn(ExpressionVariableNameMap.prototype, 'addExpressionVariable')

		controller.importExpressionVariable(controlId, {} as any)

		expect(control.postProcessImport).toHaveBeenCalledTimes(1)
		expect(control.storedWhenPostProcessed).toBe(true)
		// The saved client state includes isActive, which comes from the names map
		expect(addName).toHaveBeenCalledWith(controlId, 'v')
		expect(addName.mock.invocationCallOrder[0]).toBeLessThan(control.postProcessImport.mock.invocationCallOrder[0])
	})

	test('importCustomAction post-processes the control once it is stored', () => {
		const { controller, controls } = createController()
		const controlId = CreateCustomActionControlId('c1')
		const control = fakeImportedControl(controls, controlId)

		controller.importCustomAction(controlId, {} as any)

		expect(control.postProcessImport).toHaveBeenCalledTimes(1)
		expect(control.storedWhenPostProcessed).toBe(true)
	})

	test('createPageControl post-processes an imported page control, but not a new one', () => {
		const { controller, controls, store } = createController()
		store.getControl.mockReturnValue(undefined)

		const imported = fakeImportedControl(controls, 'page:p1')
		controller.createPageControl('p1', { type: 'page', localVariables: [] }, true)
		expect(imported.postProcessImport).toHaveBeenCalledTimes(1)
		expect(imported.storedWhenPostProcessed).toBe(true)

		const created = fakeImportedControl(controls, 'page:p2')
		controller.createPageControl('p2', null, false)
		expect(created.postProcessImport).not.toHaveBeenCalled()
	})
})
