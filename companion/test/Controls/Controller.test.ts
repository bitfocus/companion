import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import {
	CreateBankControlId,
	CreateCustomActionControlId,
	CreateCustomPresetControlId,
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

/** A stand-in for the control the factory creates, recording whether it was stored when it was started */
function fakeCreatedControl(controls: Map<string, any>, controlId: string) {
	const control = {
		controlId,
		options: { variableName: 'v' },
		supportsEntities: true,
		triggerLocationHasChanged: vi.fn(),
		commitChange: vi.fn(),
		storedWhenStarted: undefined as boolean | undefined,
		start: vi.fn((_save: boolean) => {
			control.storedWhenStarted = controls.get(controlId) === control
		}),
	}
	vi.spyOn(ControlsFactory.prototype, 'createClassForControl').mockReturnValueOnce(control as any)
	return control
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe('ControlsController.startAll', () => {
	test('starts every control, without saving it', () => {
		const { controller, controls } = createController()

		const withEntities = { supportsEntities: true, start: vi.fn() }
		const withoutEntities = { supportsEntities: false, start: vi.fn() }
		controls.set(CreateBankControlId('a'), withEntities)
		controls.set(CreateTriggerControlId('b'), withoutEntities)

		controller.startAll()

		expect(withEntities.start).toHaveBeenCalledTimes(1)
		expect(withEntities.start).toHaveBeenCalledWith(false)
		expect(withoutEntities.start).toHaveBeenCalledTimes(1)
		expect(withoutEntities.start).toHaveBeenCalledWith(false)
	})
})

describe('creating controls', () => {
	test('importTrigger starts and saves the control once it is stored', () => {
		const { controller, controls } = createController()
		const controlId = CreateTriggerControlId('t1')
		const control = fakeCreatedControl(controls, controlId)

		controller.importTrigger(controlId, {} as any)

		expect(control.start).toHaveBeenCalledTimes(1)
		expect(control.start).toHaveBeenCalledWith(true)
		expect(control.storedWhenStarted).toBe(true)
	})

	test('importExpressionVariable starts and saves the control once it is stored and its name is registered', () => {
		const { controller, controls } = createController()
		const controlId = CreateExpressionVariableControlId('e1')
		const control = fakeCreatedControl(controls, controlId)
		const addName = vi.spyOn(ExpressionVariableNameMap.prototype, 'addExpressionVariable')

		controller.importExpressionVariable(controlId, {} as any)

		expect(control.start).toHaveBeenCalledTimes(1)
		expect(control.start).toHaveBeenCalledWith(true)
		expect(control.storedWhenStarted).toBe(true)
		// The saved client state includes isActive, which comes from the names map
		expect(addName).toHaveBeenCalledWith(controlId, 'v')
		expect(addName.mock.invocationCallOrder[0]).toBeLessThan(control.start.mock.invocationCallOrder[0])
	})

	test('importCustomAction starts and saves the control once it is stored', () => {
		const { controller, controls } = createController()
		const controlId = CreateCustomActionControlId('c1')
		const control = fakeCreatedControl(controls, controlId)

		controller.importCustomAction(controlId, {} as any)

		expect(control.start).toHaveBeenCalledTimes(1)
		expect(control.start).toHaveBeenCalledWith(true)
		expect(control.storedWhenStarted).toBe(true)
	})

	test('importCustomPreset starts and saves the control once it is stored', () => {
		const { controller, controls } = createController()
		const controlId = CreateCustomPresetControlId('p1')
		const control = fakeCreatedControl(controls, controlId)

		controller.importCustomPreset(controlId, {} as any)

		expect(control.start).toHaveBeenCalledTimes(1)
		expect(control.start).toHaveBeenCalledWith(true)
		expect(control.storedWhenStarted).toBe(true)
	})

	test.each([
		['an imported', { type: 'page' as const, localVariables: [] }, true],
		['a new', null, false],
	])('createPageControl starts and saves %s page control once it is stored', (_name, storage, isImport) => {
		const { controller, controls, store } = createController()
		store.getControl.mockReturnValue(undefined)

		const control = fakeCreatedControl(controls, 'page:p1')
		controller.createPageControl('p1', storage, isImport)

		expect(control.start).toHaveBeenCalledTimes(1)
		expect(control.start).toHaveBeenCalledWith(true)
		expect(control.storedWhenStarted).toBe(true)
	})
})
