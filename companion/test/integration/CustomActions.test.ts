import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { CUSTOM_ACTIONS_CONNECTION_ID } from '@companion-app/shared/ConnectionId.js'
import {
	CreatePageControlId,
	type BankControlId,
	type CustomActionControlId,
	type SomeControlId,
} from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { CustomActionUsage } from '@companion-app/shared/Model/CustomActionModel.js'
import { EntityModelType, type EntityOwner } from '@companion-app/shared/Model/EntityModel.js'
import { exprExpr, exprVal, type ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { VariableValue } from '@companion-app/shared/Model/Variables.js'
import {
	IpcWrapper as LegacyIpcWrapper,
	// eslint-disable-next-line n/no-missing-import
} from '@companion-module/base-old/dist/host-api/ipc-wrapper.js'
import { ControlCustomAction } from '../../lib/Controls/ControlTypes/CustomAction.js'
import { MAX_CUSTOM_ACTION_DEPTH } from '../../lib/Controls/CustomActionRunFrame.js'
import { CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP } from '../../lib/Controls/CustomActions/CustomActionInstanceManager.js'
import type { ControlEntityInstance } from '../../lib/Controls/Entities/EntityInstance.js'
import { IpcWrapper } from '../../lib/Instance/Common/IpcWrapper.js'
import { createMockTrpcContext } from '../Util.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

/** Find an entity on a control */
function getEntity(app: TestApp, controlId: SomeControlId, entityId: string): ControlEntityInstance {
	const control = app.registry.controls.getControl(controlId)
	const entity = control?.supportsEntities ? control.entities.findEntityById(entityId) : undefined
	if (!entity) throw new Error(`Entity "${entityId}" does not exist on "${controlId}"`)
	return entity
}

/** The id of the only action which calls a custom action on a control */
function findCallId(app: TestApp, controlId: SomeControlId): string {
	const control = app.registry.controls.getControl(controlId)
	const calls = control?.supportsEntities
		? control.entities.getAllEntities().filter((entity) => entity.connectionId === CUSTOM_ACTIONS_CONNECTION_ID)
		: []
	if (calls.length !== 1) throw new Error(`Expected one call on "${controlId}", found ${calls.length}`)
	return calls[0].id
}

/** The value of a local variable in the copy of a custom action held by an action which calls it */
function getCopyValue(app: TestApp, controlId: SomeControlId, callId: string, variableName: string): unknown {
	const copyLocals = getEntity(app, controlId, callId).getTransientChildGroup(CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP)
	const local = copyLocals?.getDirectEntities().find((entity) => entity.localVariableName === `local:${variableName}`)
	return local ? local.feedbackValue : 'no copy'
}

describe('custom actions', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })
	})
	afterEach(async () => {
		await app.close()
	})

	/** Create a custom action which writes its `text` input, with a suffix, to the custom variable `out` */
	async function createWritingCustomAction(): Promise<CustomActionControlId> {
		const controlId = await app.trpc().controls.customActions.create({ name: 'Write' })
		await app.trpc().controls.customActions.inputAdd({
			controlId,
			field: { type: 'textinput', id: 'text', label: 'Text', default: 'default' },
		})
		app.addCustomActionAction(controlId, null, 'custom_variable_set_value', {
			name: exprVal('out'),
			create: exprVal(false),
			value: exprExpr("concat($(options:text), '!')"),
		})
		return controlId
	}

	test('a button runs a custom action with its own input values', async () => {
		app.createCustomVariable('out', '')
		const customActionId = await createWritingCustomAction()

		const first = { pageNumber: 1, row: 1, column: 1 }
		app.addCustomActionCall(app.createButton(first), customActionId, { text: exprVal('first') }, null)
		const second = { pageNumber: 1, row: 1, column: 2 }
		app.addCustomActionCall(app.createButton(second), customActionId, {}, null)

		app.pressButton(first, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('out')).toBe('first!'))

		// A missing input uses its default
		app.pressButton(second, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('out')).toBe('default!'))
	})

	test('changing an input part way through a run does not affect that run', async () => {
		app.createCustomVariable('out', '')
		const customActionId = await app.trpc().controls.customActions.create({ name: 'Slow' })
		await app.trpc().controls.customActions.inputAdd({
			controlId: customActionId,
			field: { type: 'textinput', id: 'text', label: 'Text', default: '' },
		})
		app.addCustomActionAction(customActionId, null, 'wait', { time: exprExpr('300') })
		app.addCustomActionAction(customActionId, null, 'custom_variable_set_value', {
			name: exprVal('out'),
			create: exprVal(false),
			value: exprExpr('$(options:text)'),
		})

		const location = { pageNumber: 1, row: 1, column: 1 }
		const buttonId = app.createButton(location)
		const callId = app.addCustomActionCall(buttonId, customActionId, { text: exprVal('first') }, null)
		const control = app.registry.controls.getControl(buttonId)
		const call = control?.supportsEntities ? control.entities.findEntityById(callId) : undefined
		if (!call) throw new Error('Expected the call to exist')

		// Change the input while the run waits
		app.pressButton(location, true)
		call.setOptions({ ...call.rawOptions, text: exprVal('second') })

		await vi.waitFor(() => expect(app.getCustomVariableValue('out')).toBe('first'))

		// The next run sees the change
		app.pressButton(location, false)
		app.pressButton(location, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('out')).toBe('second'))
	})

	test('an output of a custom action is written where the caller chooses', async () => {
		app.createCustomVariable('res', '')
		const customActionId = await app.trpc().controls.customActions.create({ name: 'Double' })
		await app.trpc().controls.customActions.inputAdd({
			controlId: customActionId,
			field: { type: 'number', id: 'n', label: 'N', default: 1, min: 0, max: 100 },
		})
		// A user value local variable, to hold the result
		const variableId = await app.trpc().controls.entities.add({
			controlId: customActionId,
			entityLocation: 'local-variables',
			ownerId: null,
			connectionId: 'internal',
			entityType: EntityModelType.Feedback,
			entityDefinition: 'user_value',
		})
		expect(variableId).toBeTruthy()
		await app.trpc().controls.entities.setVariableName({
			controlId: customActionId,
			entityLocation: 'local-variables',
			entityId: variableId!,
			name: 'doubled',
		})
		app.addCustomActionAction(customActionId, null, 'local_variable_set_value', {
			location: exprVal('run'),
			name: exprVal('doubled'),
			value: exprExpr('$(options:n) * 2'),
		})
		await app
			.trpc()
			.controls.customActions.outputSet({ controlId: customActionId, variableName: 'doubled', label: 'Doubled' })

		const location = { pageNumber: 1, row: 2, column: 1 }
		const buttonId = app.createButton(location)
		app.addCustomActionCall(
			buttonId,
			customActionId,
			{ n: exprVal(21) },
			{
				doubled: { type: 'custom-variable', variableName: exprVal('res'), createIfNotExists: false },
			}
		)

		app.pressButton(location, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('res')).toBe(42))
	})

	test('custom actions calling each other in a loop are reported', async () => {
		const first = await app.trpc().controls.customActions.create({ name: 'First' })
		const second = await app.trpc().controls.customActions.create({ name: 'Second' })
		const idOf = (controlId: string) => controlId.slice('custom-action:'.length)

		const addCall = async (controlId: string, calledControlId: string) => {
			// The custom actions are published as actions after a short delay
			await vi.waitFor(() =>
				expect(
					app.registry.instance.definitions.getEntityDefinition(
						EntityModelType.Action,
						CUSTOM_ACTIONS_CONNECTION_ID,
						idOf(calledControlId)
					)
				).toBeTruthy()
			)
			const id = await app.trpc().controls.entities.add({
				controlId,
				entityLocation: 'custom_action_actions',
				ownerId: null,
				connectionId: CUSTOM_ACTIONS_CONNECTION_ID,
				entityType: EntityModelType.Action,
				entityDefinition: idOf(calledControlId),
			})
			if (!id) throw new Error('Failed to add the call')
			return id
		}
		await addCall(first, second)
		const closingCallId = await addCall(second, first)

		await vi.waitFor(() => {
			const definition = app.registry.instance.definitions.getEntityDefinition(
				EntityModelType.Action,
				CUSTOM_ACTIONS_CONNECTION_ID,
				idOf(first)
			)
			expect(definition?.warning).toBe('It calls back into itself through "Second". That call back does nothing.')
		})

		const control = app.registry.controls.getControl(first)
		if (!(control instanceof ControlCustomAction)) throw new Error('Expected a custom action')
		expect(control.toClientJSON()).toMatchObject({
			calledCustomActionIds: [idOf(first), idOf(second)].sort(),
			callLoop: [idOf(first), idOf(second), idOf(first)],
			nestedTooDeep: false,
		})

		// Disabling the call which closes the loop removes the warning
		await app.trpc().controls.entities.setEnabled({
			controlId: second,
			entityLocation: 'custom_action_actions',
			entityId: closingCallId,
			enabled: false,
		})
		await vi.waitFor(() => {
			const definition = app.registry.instance.definitions.getEntityDefinition(
				EntityModelType.Action,
				CUSTOM_ACTIONS_CONNECTION_ID,
				idOf(first)
			)
			expect(definition?.warning).toBeNull()
		})
		expect(control.toClientJSON()).toMatchObject({ callLoop: null })
	})

	test('custom actions survive an export and import', async () => {
		app.createCustomVariable('out', '')
		const customActionId = await createWritingCustomAction()
		const location = { pageNumber: 1, row: 1, column: 1 }
		app.addCustomActionCall(app.createButton(location), customActionId, { text: exprVal('imported') }, null)

		const res = await app.http.get('/int/export/full?format=json').expect(200)
		const exported = JSON.parse(res.text || res.body.toString())
		expect(Object.keys(exported.customActions)).toHaveLength(1)

		// Wreck the config
		await app.trpc().controls.customActions.delete({ controlId: customActionId })
		await app.trpc().controls.resetControls({ locations: [location], newType: null })

		const ctx = createMockTrpcContext()
		ctx.pendingImport = { object: exported, timeout: null }
		await app.trpc(ctx).importExport.importFull({
			config: {
				buttons: 'reset-and-import',
				surfaces: { known: 'unchanged', instances: 'unchanged', remote: 'unchanged' },
				triggers: 'unchanged',
				customVariables: 'reset-and-import',
				expressionVariables: 'unchanged',
				customActions: 'reset-and-import',
				connections: 'unchanged',
				userconfig: 'unchanged',
				imageLibrary: 'unchanged',
			},
		})

		await vi.waitFor(() => {
			expect(app.registry.controls.getControl(customActionId)).toBeTruthy()
			expect(app.registry.page.store.getControlIdAt(location)).toBeTruthy()
		})

		app.pressButton(location, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('out')).toBe('imported!'))
	})

	/** Import the custom actions, and nothing else, from an export */
	async function importCustomActions(exported: unknown, customActions: 'reset-and-import' | 'unchanged') {
		const ctx = createMockTrpcContext()
		ctx.pendingImport = { object: exported as any, timeout: null }
		await app.trpc(ctx).importExport.importFull({
			config: {
				buttons: 'unchanged',
				surfaces: { known: 'unchanged', instances: 'unchanged', remote: 'unchanged' },
				triggers: 'unchanged',
				customVariables: 'unchanged',
				expressionVariables: 'unchanged',
				customActions,
				connections: 'unchanged',
				userconfig: 'unchanged',
				imageLibrary: 'unchanged',
			},
		})
	}

	test('a call to a deleted custom action does nothing, until the custom action is imported again', async () => {
		app.createCustomVariable('out', '')
		const customActionId = await createWritingCustomAction()
		const location = { pageNumber: 1, row: 1, column: 1 }
		const buttonId = app.createButton(location)
		app.addCustomActionCall(buttonId, customActionId, { text: exprVal('back') }, null)

		const res = await app.http.get('/int/export/full?format=json').expect(200)
		const exported = JSON.parse(res.text || res.body.toString())

		await app.trpc().controls.customActions.delete({ controlId: customActionId })
		const definitionId = customActionId.slice('custom-action:'.length)
		await vi.waitFor(() =>
			expect(
				app.registry.instance.definitions.getEntityDefinition(
					EntityModelType.Action,
					CUSTOM_ACTIONS_CONNECTION_ID,
					definitionId
				)
			).toBeUndefined()
		)

		// The call is kept, but does nothing
		expect(findCallId(app, buttonId)).toBeTruthy()
		app.pressButton(location, true)
		app.pressButton(location, false)
		await new Promise((resolve) => setTimeout(resolve, 200))
		expect(app.getCustomVariableValue('out')).toBe('')

		// Importing only the custom actions brings the call back, with the input it was given
		await importCustomActions(exported, 'reset-and-import')
		await vi.waitFor(() => {
			app.pressButton(location, true)
			app.pressButton(location, false)
			expect(app.getCustomVariableValue('out')).toBe('back!')
		})
	})

	test('importing custom actions "unchanged" keeps them, and a reset removes them and their collections', async () => {
		const collectionId = await app.trpc().controls.customActions.collections.add({ collectionName: 'Kept' })
		const customActionId = await createWritingCustomAction()
		await app.trpc().controls.customActions.reorder({ controlId: customActionId, collectionId, dropIndex: 0 })

		const exportCollectionIds = async () => {
			const res = await app.http.get('/int/export/full?format=json').expect(200)
			const exported = JSON.parse(res.text || res.body.toString())
			return { exported, collectionIds: exported.customActionCollections.map((c: { id: string }) => c.id) }
		}
		const { exported, collectionIds } = await exportCollectionIds()
		expect(collectionIds).toEqual([collectionId])
		exported.customActions = {}
		exported.customActionCollections = []

		// The export has none, but they are left alone
		await importCustomActions(exported, 'unchanged')
		expect(app.registry.controls.getControl(customActionId)).toBeTruthy()
		expect((await exportCollectionIds()).collectionIds).toEqual([collectionId])

		await app.trpc().importExport.resetConfiguration({
			config: {
				buttons: 'unchanged',
				surfaces: { known: 'unchanged', instances: 'unchanged', remote: 'unchanged' },
				triggers: 'unchanged',
				customVariables: 'unchanged',
				expressionVariables: 'unchanged',
				customActions: 'reset',
				connections: 'unchanged',
				userconfig: 'unchanged',
				imageLibrary: 'unchanged',
			},
		})
		expect(app.registry.controls.getControl(customActionId)).toBeUndefined()
		expect((await exportCollectionIds()).collectionIds).toEqual([])
	})

	test('custom actions nested three deep each see the inputs given by their own caller', async () => {
		app.createCustomVariable('out', '')
		const levels: CustomActionControlId[] = []
		for (const name of ['Outer', 'Middle', 'Inner']) {
			const controlId = await app.trpc().controls.customActions.create({ name })
			await app.trpc().controls.customActions.inputAdd({
				controlId,
				field: { type: 'textinput', id: 'text', label: 'Text', default: name },
			})
			levels.push(controlId)
		}
		const [outer, middle, inner] = levels
		// Each passes on what it was given, with something of its own
		app.addCustomActionCall(outer, middle, { text: exprExpr("concat($(options:text), ' > outer')") }, null)
		app.addCustomActionCall(middle, inner, { text: exprExpr("concat($(options:text), ' > middle')") }, null)
		app.addCustomActionAction(inner, null, 'custom_variable_set_value', {
			name: exprVal('out'),
			create: exprVal(false),
			value: exprExpr("concat($(options:text), ' > inner')"),
		})

		const first = { pageNumber: 1, row: 1, column: 1 }
		app.addCustomActionCall(app.createButton(first), outer, { text: exprVal('first') }, null)
		const second = { pageNumber: 1, row: 1, column: 2 }
		app.addCustomActionCall(app.createButton(second), outer, { text: exprVal('second') }, null)

		app.pressButton(first, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('out')).toBe('first > outer > middle > inner'))
		app.pressButton(second, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('out')).toBe('second > outer > middle > inner'))
	})

	test('a caller giving an input an invalid value runs nothing, until the value is fixed', async () => {
		app.createCustomVariable('out', 0)
		const customActionId = await app.trpc().controls.customActions.create({ name: 'Ranged' })
		await app.trpc().controls.customActions.inputAdd({
			controlId: customActionId,
			field: { type: 'number', id: 'n', label: 'N', default: 1, min: 0, max: 100 },
		})
		app.addCustomActionAction(customActionId, null, 'custom_variable_set_value', {
			name: exprVal('out'),
			create: exprVal(false),
			value: exprExpr('$(options:n)'),
		})

		const location = { pageNumber: 1, row: 1, column: 1 }
		const buttonId = app.createButton(location)
		const callId = app.addCustomActionCall(buttonId, customActionId, { n: exprVal(500) }, null)
		const call = getEntity(app, buttonId, callId)

		const pressAndSettle = async () => {
			app.pressButton(location, true)
			app.pressButton(location, false)
			await new Promise((resolve) => setTimeout(resolve, 200))
		}

		// Out of range
		await pressAndSettle()
		expect(app.getCustomVariableValue('out')).toBe(0)

		// An expression which fails
		call.setOptions({ n: exprExpr('nonsense(') })
		await pressAndSettle()
		expect(app.getCustomVariableValue('out')).toBe(0)

		call.setOptions({ n: exprVal(7) })
		await pressAndSettle()
		expect(app.getCustomVariableValue('out')).toBe(7)
	})
})

describe('long running custom actions', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })
	})
	afterEach(async () => {
		await app.close()
	})

	/** Record each value a custom variable takes, as it changes */
	function recordCustomVariable(name: string): VariableValue[] {
		const history: VariableValue[] = []
		app.registry.variables.values.on('variablesChanged', (changed) => {
			if (changed.has(`custom:${name}`)) history.push(app.getCustomVariableValue(name))
		})
		return history
	}

	/**
	 * Create a custom action which counts up in a loop: while `condition` is true it adds `$(options:step)` to its local
	 * variable `count` and then sleeps. `count` is its output `count`, so the caller can see each step of the count.
	 * Returns the custom action, and the owner of the loop's actions, for a test to add to them
	 */
	async function createCountingCustomAction(
		name: string,
		condition: string,
		increment: string,
		sleepMs: number
	): Promise<{ controlId: CustomActionControlId; body: EntityOwner }> {
		const controlId = await app.trpc().controls.customActions.create({ name })
		await app.trpc().controls.customActions.inputAdd({
			controlId,
			field: { type: 'number', id: 'step', label: 'Step', default: 1, min: -1000, max: 1000 },
		})
		app.addLocalVariable(controlId, 'count', 'user_value', { startup_value: exprVal(0) })

		const loopId = app.addCustomActionAction(controlId, null, 'logic_while', {})
		app.addCustomActionChildFeedback(controlId, { parentId: loopId, childGroup: 'condition' }, 'check_expression', {
			expression: exprVal(condition),
		})
		const body: EntityOwner = { parentId: loopId, childGroup: 'actions' }
		app.addCustomActionAction(controlId, body, 'local_variable_set_value', {
			location: exprVal('run'),
			name: exprVal('count'),
			value: exprExpr(increment),
		})
		app.addCustomActionAction(controlId, body, 'wait', { time: exprExpr(String(sleepMs)) })

		await app.trpc().controls.customActions.outputSet({ controlId, variableName: 'count', label: 'Count' })

		return { controlId, body }
	}

	/** Add a button which calls a custom action, writing its `count` output to a custom variable */
	function addCountingButton(
		location: ControlLocation,
		customActionId: CustomActionControlId,
		options: Record<string, ExpressionOrValue<any>>,
		outputVariable: string
	): BankControlId {
		const buttonId = app.createButton(location)
		app.addCustomActionCall(buttonId, customActionId, options, {
			count: { type: 'custom-variable', variableName: exprVal(outputVariable), createIfNotExists: false },
		})
		return buttonId
	}

	test('an output reaches the caller at each step of a loop, not only when the run ends', async () => {
		app.createCustomVariable('progress', 0)
		const history = recordCustomVariable('progress')
		const { controlId: customActionId } = await createCountingCustomAction(
			'Count',
			'$(local:count) < 3',
			'$(local:count) + $(options:step)',
			150
		)

		const location = { pageNumber: 1, row: 1, column: 1 }
		addCountingButton(location, customActionId, {}, 'progress')

		app.pressButton(location, true)

		// The first step is seen while the run is still sleeping before the next
		await vi.waitFor(() => expect(app.getCustomVariableValue('progress')).toBe(1))
		expect(history).toEqual([1])

		await vi.waitFor(() => expect(app.getCustomVariableValue('progress')).toBe(3))
		expect(history).toEqual([1, 2, 3])
	})

	test('concurrent runs of a custom action count with their own local variables and inputs', async () => {
		app.createCustomVariable('small', 0)
		app.createCustomVariable('big', 0)
		const smallHistory = recordCustomVariable('small')
		const bigHistory = recordCustomVariable('big')
		const { controlId: customActionId } = await createCountingCustomAction(
			'Count',
			'$(local:count) < 3 * $(options:step)',
			'$(local:count) + $(options:step)',
			100
		)

		const small = { pageNumber: 1, row: 1, column: 1 }
		addCountingButton(small, customActionId, { step: exprVal(1) }, 'small')
		const big = { pageNumber: 1, row: 1, column: 2 }
		addCountingButton(big, customActionId, { step: exprVal(10) }, 'big')

		// Both runs are part way through their loops at the same time
		app.pressButton(small, true)
		app.pressButton(big, true)

		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('small')).toBe(3)
			expect(app.getCustomVariableValue('big')).toBe(30)
		})
		expect(smallHistory).toEqual([1, 2, 3])
		expect(bigHistory).toEqual([10, 20, 30])
	})

	test('pressing a button again while its custom action runs starts a second run, with its own local variables', async () => {
		app.createCustomVariable('progress', 0)
		app.createCustomVariable('log', '')
		const { controlId: customActionId, body } = await createCountingCustomAction(
			'Count',
			'$(local:count) < 3',
			'$(local:count) + $(options:step)',
			150
		)
		// Both runs write the same output values, so each step is also logged, to see every step of both runs
		app.addCustomActionAction(customActionId, body, 'custom_variable_set_value', {
			name: exprVal('log'),
			create: exprVal(false),
			value: exprExpr('concat($(custom:log), $(local:count))'),
		})

		const location = { pageNumber: 1, row: 1, column: 1 }
		addCountingButton(location, customActionId, {}, 'progress')

		app.pressButton(location, true)
		app.pressButton(location, false)
		await vi.waitFor(() => expect(app.getCustomVariableValue('log')).toBe('1'))

		// The first run is still sleeping, part way through its count
		app.pressButton(location, true)
		app.pressButton(location, false)

		// Each run counts from the start, rather than carrying on from the other
		const log = () => app.getCustomVariableValue('log') as string
		await vi.waitFor(() => expect(log()).toHaveLength(6))
		expect(log().split('').toSorted()).toEqual(['1', '1', '2', '2', '3', '3'])
		expect(app.getCustomVariableValue('progress')).toBe(3)
	})

	test('a run keeps the inputs it started with, but sees the changes to other variables as it loops', async () => {
		app.createCustomVariable('keepGoing', true)
		app.createCustomVariable('base', 100)
		app.createCustomVariable('progress', 0)
		const history = recordCustomVariable('progress')
		// The step is given from a variable, and the loop runs while another variable says so
		const { controlId: customActionId } = await createCountingCustomAction(
			'Count',
			'$(custom:keepGoing)',
			'$(local:count) + $(options:step)',
			100
		)

		const location = { pageNumber: 1, row: 1, column: 1 }
		addCountingButton(location, customActionId, { step: exprExpr('$(custom:base)') }, 'progress')

		app.pressButton(location, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('progress')).toBe(200))

		// The input was fixed when the run started
		app.registry.variables.custom.setValue('base', 1)
		await vi.waitFor(() => expect(app.getCustomVariableValue('progress')).toBe(300))

		// But the condition sees the variable change, and stops the loop
		app.registry.variables.custom.setValue('keepGoing', false)
		const stoppedAt = history.length
		await new Promise((resolve) => setTimeout(resolve, 400))
		expect(history.length - stoppedAt).toBeLessThanOrEqual(1)
		expect(history.every((value, i) => value === (i + 1) * 100)).toBe(true)

		// The next run sees the new input
		app.registry.variables.custom.setValue('keepGoing', true)
		app.pressButton(location, false)
		app.pressButton(location, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('progress')).toBe(2))
		app.registry.variables.custom.setValue('keepGoing', false)
	})

	test('aborting the caller stops a custom action part way through its loop', async () => {
		app.createCustomVariable('progress', 0)
		const { controlId: customActionId } = await createCountingCustomAction(
			'Forever',
			'true',
			'$(local:count) + $(options:step)',
			100
		)

		const location = { pageNumber: 1, row: 1, column: 1 }
		const buttonId = addCountingButton(location, customActionId, {}, 'progress')

		app.pressButton(location, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('progress')).toBe(2))

		app.registry.controls.getControl(buttonId)?.abortDelayedActions(false, null, 0)
		const stoppedAt = app.getCustomVariableValue('progress') as number

		await new Promise((resolve) => setTimeout(resolve, 400))
		// A step already past its sleep may still finish, but the loop goes no further
		expect(app.getCustomVariableValue('progress')).toBeLessThanOrEqual(stoppedAt + 1)
	})

	test('the output of a nested custom action bubbles up through the custom action calling it', async () => {
		app.createCustomVariable('progress', 0)
		const history = recordCustomVariable('progress')

		// The inner custom action counts up in a loop, reporting each step
		const { controlId: innerId } = await createCountingCustomAction(
			'Inner',
			'$(local:count) < 3',
			'$(local:count) + $(options:step)',
			100
		)

		// The outer one calls it, writing its output to a local variable which is the outer's own output
		const outerId = await app.trpc().controls.customActions.create({ name: 'Outer' })
		app.addLocalVariable(outerId, 'count', 'user_value', { startup_value: exprVal(0) })
		await vi.waitFor(() =>
			expect(
				app.registry.instance.definitions.getEntityDefinition(
					EntityModelType.Action,
					CUSTOM_ACTIONS_CONNECTION_ID,
					innerId.slice('custom-action:'.length)
				)
			).toBeTruthy()
		)
		app.addCustomActionCall(
			outerId,
			innerId,
			{ step: exprVal(1) },
			{
				count: { type: 'local-variable', location: exprVal('run'), variableName: exprVal('count') },
			}
		)
		await app.trpc().controls.customActions.outputSet({ controlId: outerId, variableName: 'count', label: 'Seen' })

		const location = { pageNumber: 1, row: 1, column: 1 }
		addCountingButton(location, outerId, {}, 'progress')

		app.pressButton(location, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('progress')).toBe(3))
		expect(history).toEqual([1, 2, 3])
	})

	test('deleting a custom action stops the runs of it which are in progress', async () => {
		app.createCustomVariable('progress', 0)
		const { controlId: customActionId } = await createCountingCustomAction(
			'Forever',
			'true',
			'$(local:count) + $(options:step)',
			100
		)
		const location = { pageNumber: 1, row: 1, column: 1 }
		const buttonId = addCountingButton(location, customActionId, {}, 'progress')

		app.pressButton(location, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('progress')).toBe(2))

		expect(await app.trpc().controls.customActions.delete({ controlId: customActionId })).toBe(true)
		const stoppedAt = app.getCustomVariableValue('progress') as number
		await new Promise((resolve) => setTimeout(resolve, 400))
		expect(app.getCustomVariableValue('progress')).toBeLessThanOrEqual(stoppedAt + 1)

		// The call is left on the button, and does nothing
		expect(findCallId(app, buttonId)).toBeTruthy()
		app.registry.variables.custom.setValue('progress', 0)
		app.pressButton(location, false)
		app.pressButton(location, true)
		await new Promise((resolve) => setTimeout(resolve, 300))
		expect(app.getCustomVariableValue('progress')).toBe(0)
	})

	test('the value a caller gives for an input is dropped when the input is removed', async () => {
		const { controlId: customActionId } = await createCountingCustomAction('Count', 'false', '0', 1)
		const buttonId = addCountingButton({ pageNumber: 1, row: 1, column: 1 }, customActionId, { step: exprVal(7) }, 'x')
		app.createCustomVariable('x', 0)
		const callId = findCallId(app, buttonId)
		expect(getEntity(app, buttonId, callId).rawOptions).toEqual({ step: exprVal(7) })

		await app.trpc().controls.customActions.inputRemove({ controlId: customActionId, inputId: 'step' })

		// Otherwise a new input of the same id would pick up a value given for the old one
		expect(getEntity(app, buttonId, callId).rawOptions).toEqual({})
	})

	test('the local variable actions reset a variable of the run, but do not write the startup value of the custom action', async () => {
		app.createCustomVariable('set', '')
		app.createCustomVariable('reset', '')
		app.createCustomVariable('synced', '')
		const customActionId = await app.trpc().controls.customActions.create({ name: 'Reset' })
		const storedId = app.addLocalVariable(customActionId, 'v', 'user_value', { startup_value: exprVal(5) })

		const groupId = app.addCustomActionAction(customActionId, null, 'action_group', {
			execution_mode: exprVal('sequential'),
		})
		const inOrder = { parentId: groupId, childGroup: 'default' }
		const local = { location: exprVal('run'), name: exprVal('v') }
		const record = (variable: string) =>
			app.addCustomActionAction(customActionId, inOrder, 'custom_variable_set_value', {
				name: exprVal(variable),
				create: exprVal(false),
				value: exprExpr('$(local:v)'),
			})
		app.addCustomActionAction(customActionId, inOrder, 'local_variable_set_value', { ...local, value: exprExpr('10') })
		record('set')
		app.addCustomActionAction(customActionId, inOrder, 'local_variable_reset_to_default', local)
		record('reset')
		app.addCustomActionAction(customActionId, inOrder, 'local_variable_set_value', { ...local, value: exprExpr('20') })
		app.addCustomActionAction(customActionId, inOrder, 'local_variable_sync_to_default', local)
		app.addCustomActionAction(customActionId, inOrder, 'local_variable_reset_to_default', local)
		record('synced')

		const location = { pageNumber: 1, row: 1, column: 1 }
		app.addCustomActionCall(app.createButton(location), customActionId, {}, null)

		app.pressButton(location, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('synced')).not.toBe(''))

		expect(app.getCustomVariableValue('set')).toBe(10)
		expect(app.getCustomVariableValue('reset')).toBe(5)
		// Writing the startup value is refused within a run, so resetting again gives the original startup value
		expect(app.getCustomVariableValue('synced')).toBe(5)

		const stored = getEntity(app, customActionId, storedId)
		expect(stored.rawOptions.startup_value).toEqual(exprVal(5))
		expect(stored.feedbackValue).toBe(5)
	})

	test('an output target can be an expression, resolved in the context of the caller', async () => {
		const { controlId: customActionId } = await createCountingCustomAction(
			'Count',
			'$(local:count) < 2',
			'$(local:count) + $(options:step)',
			10
		)
		app.createCustomVariable('out_3', 0)
		app.createCustomVariable('out_4', 0)

		for (const column of [3, 4]) {
			const location = { pageNumber: 1, row: 1, column }
			app.addCustomActionCall(
				app.createButton(location),
				customActionId,
				{ step: exprVal(column) },
				{
					count: {
						type: 'custom-variable',
						variableName: exprExpr("concat('out_', $(this:column))"),
						createIfNotExists: false,
					},
				}
			)
			app.pressButton(location, true)
		}

		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('out_3')).toBe(3)
			expect(app.getCustomVariableValue('out_4')).toBe(4)
		})
	})

	test('custom actions nested too deeply stop at the limit when run, and say so', async () => {
		// A chain of custom actions each calling the next, one longer than the limit
		const depth = MAX_CUSTOM_ACTION_DEPTH + 1
		const ids: CustomActionControlId[] = []
		for (let i = 0; i < depth; i++) {
			app.createCustomVariable(`ran_${i}`, false)
			ids.push(await app.trpc().controls.customActions.create({ name: `Level ${i}` }))
		}
		for (let i = depth - 1; i >= 0; i--) {
			app.addCustomActionAction(ids[i], null, 'custom_variable_set_value', {
				name: exprVal(`ran_${i}`),
				create: exprVal(false),
				value: exprExpr('true'),
			})
			if (i + 1 < depth) app.addCustomActionCall(ids[i], ids[i + 1], {}, null)
		}

		const location = { pageNumber: 1, row: 1, column: 1 }
		app.addCustomActionCall(app.createButton(location), ids[0], {}, null)
		app.pressButton(location, true)

		await vi.waitFor(() => expect(app.getCustomVariableValue(`ran_${MAX_CUSTOM_ACTION_DEPTH - 1}`)).toBe(true))
		await new Promise((resolve) => setTimeout(resolve, 200))
		expect(app.getCustomVariableValue(`ran_${MAX_CUSTOM_ACTION_DEPTH}`)).toBe(false)

		const first = app.registry.controls.getControl(ids[0])
		if (!(first instanceof ControlCustomAction)) throw new Error('Expected a custom action')
		await vi.waitFor(() => expect(first.toClientJSON().nestedTooDeep).toBe(true))
	})

	test('moving the caller part way through a run stops the run of the custom action', async () => {
		app.createCustomVariable('progress', 0)
		const { controlId: customActionId } = await createCountingCustomAction(
			'Forever',
			'true',
			'$(local:count) + $(options:step)',
			100
		)
		const from = { pageNumber: 1, row: 1, column: 1 }
		addCountingButton(from, customActionId, {}, 'progress')

		app.pressButton(from, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('progress')).toBe(2))

		expect(
			await app.trpc().controls.gridBatchTransfer({
				operation: 'move',
				pairs: [{ fromLocation: from, toLocation: { pageNumber: 1, row: 2, column: 2 } }],
			})
		).toBe(true)
		const stoppedAt = app.getCustomVariableValue('progress') as number

		await new Promise((resolve) => setTimeout(resolve, 400))
		expect(app.getCustomVariableValue('progress')).toBeLessThanOrEqual(stoppedAt + 1)
	})

	test('copying the caller part way through a run leaves it running, but swapping it stops the run', async () => {
		app.createCustomVariable('progress', 0)
		const { controlId: customActionId } = await createCountingCustomAction(
			'Forever',
			'true',
			'$(local:count) + $(options:step)',
			100
		)
		const from = { pageNumber: 1, row: 1, column: 1 }
		addCountingButton(from, customActionId, {}, 'progress')
		app.createButton({ pageNumber: 1, row: 2, column: 2 })

		app.pressButton(from, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('progress')).toBe(2))

		expect(
			await app.trpc().controls.gridBatchTransfer({
				operation: 'copy',
				pairs: [{ fromLocation: from, toLocation: { pageNumber: 1, row: 3, column: 3 } }],
			})
		).toBe(true)
		const copiedAt = app.getCustomVariableValue('progress') as number
		await vi.waitFor(() => expect(app.getCustomVariableValue('progress')).toBeGreaterThan(copiedAt + 1))

		expect(
			await app.trpc().controls.gridBatchTransfer({
				operation: 'swap',
				pairs: [{ fromLocation: from, toLocation: { pageNumber: 1, row: 2, column: 2 } }],
			})
		).toBe(true)
		const stoppedAt = app.getCustomVariableValue('progress') as number
		await new Promise((resolve) => setTimeout(resolve, 400))
		expect(app.getCustomVariableValue('progress')).toBeLessThanOrEqual(stoppedAt + 1)
	})

	test('a change to where the caller is part way through a run is seen as it would be by the actions of a button', async () => {
		app.addLocalVariable(CreatePageControlId(app.registry.page.store.getPageId(1)!), 'name', 'user_value', {
			startup_value: exprVal('the page'),
		})
		app.createCustomVariable('fromButton', '')
		app.createCustomVariable('fromCustomAction', '')
		const where = "concat($(this:page), '/', $(this:row), '/', $(this:column), ' ', $(page:name))"

		// The custom action waits, then reports where it is
		const customActionId = await app.trpc().controls.customActions.create({ name: 'Where' })
		const groupId = app.addCustomActionAction(customActionId, null, 'action_group', {
			execution_mode: exprVal('sequential'),
		})
		const inOrder = { parentId: groupId, childGroup: 'default' }
		app.addCustomActionAction(customActionId, inOrder, 'wait', { time: exprExpr('300') })
		app.addCustomActionAction(customActionId, inOrder, 'custom_variable_set_value', {
			name: exprVal('fromCustomAction'),
			create: exprVal(false),
			value: exprExpr(where),
		})

		// The button does the same itself, and calls the custom action
		const from = { pageNumber: 1, row: 1, column: 1 }
		const buttonId = app.createButton(from)
		const buttonGroupId = app.addInternalAction(buttonId, 'action_group', { execution_mode: exprVal('sequential') })
		const buttonInOrder = { parentId: buttonGroupId, childGroup: 'default' }
		app.addInternalChildAction(buttonId, buttonInOrder, 'wait', { time: exprExpr('300') })
		app.addInternalChildAction(buttonId, buttonInOrder, 'custom_variable_set_value', {
			name: exprVal('fromButton'),
			create: exprVal(false),
			value: exprExpr(where),
		})
		app.addCustomActionCall(buttonId, customActionId, {}, null)

		app.pressButton(from, true)
		await new Promise((resolve) => setTimeout(resolve, 50))
		// A new first page renumbers the page the caller is on, without moving it
		await app.trpc().pages.insert({ asPageNumber: 1, pageNames: ['New first'] })

		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('fromButton')).not.toBe('')
			expect(app.getCustomVariableValue('fromCustomAction')).not.toBe('')
		})
		expect(app.getCustomVariableValue('fromButton')).toBe('2/1/1 the page')
		expect(app.getCustomVariableValue('fromCustomAction')).toBe(app.getCustomVariableValue('fromButton'))
	})

	/** The current usage of a custom action, as the editor sees it */
	async function readUsage(customActionId: CustomActionControlId): Promise<CustomActionUsage> {
		const iterable = await app.trpc().controls.customActions.watchUsage({ controlId: customActionId })
		const iterator = iterable[Symbol.asyncIterator]()
		try {
			const { value } = await iterator.next()
			return value as CustomActionUsage
		} finally {
			await iterator.return?.()
		}
	}

	test('the uses of a custom action show the runs of each, which can be aborted on their own or all together', async () => {
		app.createCustomVariable('first', 0)
		app.createCustomVariable('second', 0)
		const { controlId: customActionId } = await createCountingCustomAction(
			'Forever',
			'true',
			'$(local:count) + $(options:step)',
			100
		)
		const firstLocation = { pageNumber: 1, row: 1, column: 1 }
		const firstId = addCountingButton(firstLocation, customActionId, {}, 'first')
		const secondLocation = { pageNumber: 1, row: 1, column: 2 }
		const secondId = addCountingButton(secondLocation, customActionId, {}, 'second')

		// Not running yet
		expect(await readUsage(customActionId)).toEqual({
			uses: expect.arrayContaining([
				{ controlId: firstId, entityId: findCallId(app, firstId), disabled: false, runs: [] },
				{ controlId: secondId, entityId: findCallId(app, secondId), disabled: false, runs: [] },
			]),
			otherRuns: [],
		})

		app.pressButton(firstLocation, true)
		app.pressButton(secondLocation, true)
		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('first')).toBeGreaterThanOrEqual(2)
			expect(app.getCustomVariableValue('second')).toBeGreaterThanOrEqual(2)
		})

		const running = await readUsage(customActionId)
		for (const use of running.uses) {
			expect(use.runs).toEqual([{ runId: expect.any(String), controlId: use.controlId, startedAt: expect.any(Number) }])
		}

		// Stopping the runs of the first leaves the second going
		expect(
			await app
				.trpc()
				.controls.customActions.abortUse({ controlId: customActionId, entityId: findCallId(app, firstId) })
		).toBe(1)
		const firstStoppedAt = app.getCustomVariableValue('first') as number
		const secondBefore = app.getCustomVariableValue('second') as number
		await new Promise((resolve) => setTimeout(resolve, 400))
		expect(app.getCustomVariableValue('first')).toBeLessThanOrEqual(firstStoppedAt + 1)
		expect(app.getCustomVariableValue('second')).toBeGreaterThan(secondBefore + 1)

		const afterOne = await readUsage(customActionId)
		expect(afterOne.uses.find((use) => use.controlId === firstId)?.runs).toEqual([])
		expect(afterOne.uses.find((use) => use.controlId === secondId)?.runs).toHaveLength(1)

		// And all of them stops the rest
		expect(await app.trpc().controls.customActions.abortAll({ controlId: customActionId })).toBe(1)
		await vi.waitFor(async () => {
			const stopped = await readUsage(customActionId)
			expect(stopped.uses.every((use) => use.runs.length === 0)).toBe(true)
		})
	})

	test('a run inside another custom action is listed against the call in that custom action', async () => {
		app.createCustomVariable('progress', 0)
		const { controlId: innerId } = await createCountingCustomAction(
			'Forever',
			'true',
			'$(local:count) + $(options:step)',
			100
		)
		const outerId = await app.trpc().controls.customActions.create({ name: 'Outer' })
		app.addLocalVariable(outerId, 'count', 'user_value', { startup_value: exprVal(0) })
		app.addCustomActionCall(
			outerId,
			innerId,
			{},
			{
				count: { type: 'local-variable', location: exprVal('run'), variableName: exprVal('count') },
			}
		)
		await app.trpc().controls.customActions.outputSet({ controlId: outerId, variableName: 'count', label: 'Seen' })

		const location = { pageNumber: 1, row: 1, column: 1 }
		const buttonId = addCountingButton(location, outerId, {}, 'progress')
		app.pressButton(location, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('progress')).toBeGreaterThanOrEqual(2))

		// The inner one is called from the outer, running from the button
		const innerCallId = findCallId(app, outerId)
		const usage = await readUsage(innerId)
		expect(usage.uses).toEqual([
			{
				controlId: outerId,
				entityId: innerCallId,
				disabled: false,
				runs: [{ runId: expect.any(String), controlId: buttonId, startedAt: expect.any(Number) }],
			},
		])
		expect(usage.otherRuns).toEqual([])

		// Stopping it there stops the loop
		expect(await app.trpc().controls.customActions.abortUse({ controlId: innerId, entityId: innerCallId })).toBe(1)
		const stoppedAt = app.getCustomVariableValue('progress') as number
		await new Promise((resolve) => setTimeout(resolve, 400))
		expect(app.getCustomVariableValue('progress')).toBeLessThanOrEqual(stoppedAt + 1)
	})

	test('a test run from the editor can be aborted', async () => {
		app.createCustomVariable('tick', 0)
		const { controlId: customActionId, body } = await createCountingCustomAction(
			'Forever',
			'true',
			'$(local:count) + $(options:step)',
			100
		)
		app.addCustomActionAction(customActionId, body, 'custom_variable_set_value', {
			name: exprVal('tick'),
			create: exprVal(false),
			value: exprExpr('$(local:count)'),
		})
		const control = app.registry.controls.getControl(customActionId)
		if (!(control instanceof ControlCustomAction)) throw new Error('Expected a custom action')

		expect(await app.trpc().controls.customActions.testRun({ controlId: customActionId })).toBe(true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('tick')).toBeGreaterThanOrEqual(2))
		expect(control.toRuntimeJSON().testRunning).toBe(true)

		expect(await app.trpc().controls.customActions.abortTestRun({ controlId: customActionId })).toBe(true)
		await vi.waitFor(() => expect(control.toRuntimeJSON().testRunning).toBe(false))
		const stoppedAt = app.getCustomVariableValue('tick') as number
		await new Promise((resolve) => setTimeout(resolve, 400))
		expect(app.getCustomVariableValue('tick')).toBeLessThanOrEqual(stoppedAt + 1)
	})
})

describe('custom action scope and copies', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })
	})
	afterEach(async () => {
		await app.close()
	})

	/** The id of a local variable of a custom action itself */
	function getStoredLocalVariableId(customActionId: CustomActionControlId, variableName: string): string {
		const control = app.registry.controls.getControl(customActionId)
		if (!(control instanceof ControlCustomAction)) throw new Error('Expected a custom action')
		const local = control.entities
			.getLocalVariableEntities()
			.find((entity) => entity.localVariableName === `local:${variableName}`)
		if (!local) throw new Error(`Expected the local variable "${variableName}"`)
		return local.id
	}

	/**
	 * Create a custom action with an input `n`, a local variable `double` computed from it, and an output `result`
	 * which a run sets to it
	 */
	async function createDoublingCustomAction(): Promise<CustomActionControlId> {
		const controlId = await app.trpc().controls.customActions.create({ name: 'Double' })
		await app.trpc().controls.customActions.inputAdd({
			controlId,
			field: { type: 'number', id: 'n', label: 'N', default: 1, min: -1000, max: 1000 },
		})
		app.addLocalVariable(controlId, 'double', 'expression_value', { expression: exprVal('$(options:n) * 2') })
		// Only a user value can be an output
		app.addLocalVariable(controlId, 'result', 'user_value', { startup_value: exprVal(0) })
		app.addCustomActionAction(controlId, null, 'local_variable_set_value', {
			location: exprVal('run'),
			name: exprVal('result'),
			value: exprExpr('$(local:double)'),
		})
		await app.trpc().controls.customActions.outputSet({ controlId, variableName: 'result', label: 'Result' })
		return controlId
	}

	test('the local variables of a custom action are its own, and $(this:*) is the caller', async () => {
		app.createCustomVariable('inner', '')
		app.createCustomVariable('where', '')

		const customActionId = await app.trpc().controls.customActions.create({ name: 'Scoped' })
		const storedLocalId = app.addLocalVariable(customActionId, 'count', 'user_value', {
			startup_value: exprVal(0),
		})
		// The actions of a button run concurrently, and those of the custom action with them, so these are in order
		const groupId = app.addCustomActionAction(customActionId, null, 'action_group', {
			execution_mode: exprVal('sequential'),
		})
		const inOrder = { parentId: groupId, childGroup: 'default' }
		app.addCustomActionAction(customActionId, inOrder, 'local_variable_set_value', {
			location: exprVal('run'),
			name: exprVal('count'),
			value: exprExpr('$(local:count) + 1'),
		})
		app.addCustomActionAction(customActionId, inOrder, 'custom_variable_set_value', {
			name: exprVal('inner'),
			create: exprVal(false),
			value: exprExpr('$(local:count)'),
		})
		app.addCustomActionAction(customActionId, inOrder, 'custom_variable_set_value', {
			name: exprVal('where'),
			create: exprVal(false),
			value: exprExpr("concat($(this:row), '/', $(this:column))"),
		})

		// The button has a local variable of the same name
		const location = { pageNumber: 1, row: 2, column: 3 }
		const buttonId = app.createButton(location)
		const buttonLocalId = app.addLocalVariable(buttonId, 'count', 'user_value', { startup_value: exprVal(99) })
		app.addCustomActionCall(buttonId, customActionId, {}, null)

		app.pressButton(location, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('where')).toBe('2/3'))

		// The custom action counted with its own variable, which neither the button nor the custom action itself keep
		expect(app.getCustomVariableValue('inner')).toBe(1)
		expect(app.getFeedbackValue(buttonId, buttonLocalId)).toBe(99)
		expect(app.getFeedbackValue(customActionId, storedLocalId)).toBe(0)

		// So the next run starts again from the startup value
		app.registry.variables.custom.setValue('inner', '')
		app.pressButton(location, false)
		app.pressButton(location, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('inner')).toBe(1))
		expect(app.getFeedbackValue(buttonId, buttonLocalId)).toBe(99)
	})

	test('an output can be written to a page variable, or to a custom variable which it creates', async () => {
		const pageControlId = CreatePageControlId(app.registry.page.store.getPageId(1)!)
		const pageVariableId = app.addLocalVariable(pageControlId, 'shown', 'user_value', { startup_value: exprVal(0) })
		const customActionId = await createDoublingCustomAction()

		const toPage = { pageNumber: 1, row: 1, column: 1 }
		app.addCustomActionCall(
			app.createButton(toPage),
			customActionId,
			{ n: exprVal(4) },
			// Page 0 is the page of the caller
			{ result: { type: 'page-variable', page: exprVal('0'), variableName: exprVal('shown') } }
		)
		const toCustom = { pageNumber: 1, row: 1, column: 2 }
		app.addCustomActionCall(
			app.createButton(toCustom),
			customActionId,
			{ n: exprVal(6) },
			{ result: { type: 'custom-variable', variableName: exprVal('made'), createIfNotExists: true } }
		)

		app.pressButton(toPage, true)
		await vi.waitFor(() => expect(app.getFeedbackValue(pageControlId, pageVariableId)).toBe(8))

		expect(app.registry.variables.custom.hasCustomVariable('made')).toBe(false)
		app.pressButton(toCustom, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('made')).toBe(12))
	})

	test('setting a local variable in a run sees the other local variables as the run has them', async () => {
		app.createCustomVariable('out', 0)
		const customActionId = await createDoublingCustomAction()
		app.addLocalVariable(customActionId, 'copied', 'user_value', { startup_value: exprVal(0) })

		const groupId = app.addCustomActionAction(customActionId, null, 'action_group', {
			execution_mode: exprVal('sequential'),
		})
		const inOrder = { parentId: groupId, childGroup: 'default' }
		// $(target:double) is computed from the input of the caller, rather than its default
		app.addCustomActionAction(customActionId, inOrder, 'local_variable_set_value', {
			location: exprVal('run'),
			name: exprVal('copied'),
			value: exprExpr('$(target:double)'),
		})
		app.addCustomActionAction(customActionId, inOrder, 'custom_variable_set_value', {
			name: exprVal('out'),
			create: exprVal(false),
			value: exprExpr('$(local:copied)'),
		})

		const location = { pageNumber: 1, row: 1, column: 1 }
		app.addCustomActionCall(app.createButton(location), customActionId, { n: exprVal(5) }, null)

		app.pressButton(location, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('out')).toBe(10))
	})

	test('the location "this" in a custom action is the calling control, as $(this:*) is, and "run" is the run', async () => {
		const customActionId = await app.trpc().controls.customActions.create({ name: 'Writer' })
		app.addLocalVariable(customActionId, 'v', 'user_value', { startup_value: exprVal(0) })
		app.addCustomActionAction(customActionId, null, 'local_variable_set_value', {
			location: exprVal('this'),
			name: exprVal('v'),
			value: exprExpr('42'),
		})
		app.addCustomActionAction(customActionId, null, 'local_variable_set_value', {
			location: exprVal('run'),
			name: exprVal('v'),
			value: exprExpr('7'),
		})

		const location = { pageNumber: 1, row: 1, column: 1 }
		const buttonId = app.createButton(location)
		const buttonLocalId = app.addLocalVariable(buttonId, 'v', 'user_value', { startup_value: exprVal(0) })
		app.addCustomActionCall(buttonId, customActionId, {}, null)

		app.pressButton(location, true)
		await vi.waitFor(() => expect(app.getFeedbackValue(buttonId, buttonLocalId)).toBe(42))

		// The run only changed its own copy
		expect(app.getFeedbackValue(customActionId, getStoredLocalVariableId(customActionId, 'v'))).toBe(0)
	})

	test('a custom action writing to a local variable of its caller does so through an output only', async () => {
		const customActionId = await app.trpc().controls.customActions.create({ name: 'Writer' })
		app.addLocalVariable(customActionId, 'result', 'user_value', { startup_value: exprVal(0) })
		app.addCustomActionAction(customActionId, null, 'local_variable_set_value', {
			location: exprVal('run'),
			name: exprVal('result'),
			value: exprExpr('42'),
		})
		await app
			.trpc()
			.controls.customActions.outputSet({ controlId: customActionId, variableName: 'result', label: 'Result' })

		// Two buttons with a local variable of the same name, only one of which takes the output
		const withOutput = { pageNumber: 1, row: 1, column: 1 }
		const withOutputId = app.createButton(withOutput)
		const withOutputLocalId = app.addLocalVariable(withOutputId, 'result', 'user_value', {
			startup_value: exprVal(0),
		})
		app.addCustomActionCall(
			withOutputId,
			customActionId,
			{},
			{
				result: { type: 'local-variable', location: exprVal('this'), variableName: exprVal('result') },
			}
		)
		const without = { pageNumber: 1, row: 1, column: 2 }
		const withoutId = app.createButton(without)
		const withoutLocalId = app.addLocalVariable(withoutId, 'result', 'user_value', { startup_value: exprVal(0) })
		app.addCustomActionCall(withoutId, customActionId, {}, null)

		app.pressButton(withOutput, true)
		app.pressButton(without, true)
		await vi.waitFor(() => expect(app.getFeedbackValue(withOutputId, withOutputLocalId)).toBe(42))

		await new Promise((resolve) => setTimeout(resolve, 200))
		expect(app.getFeedbackValue(withoutId, withoutLocalId)).toBe(0)
	})

	test('the copy held by each caller follows its own inputs, and only its own', async () => {
		app.createCustomVariable('a', 1)
		const customActionId = await createDoublingCustomAction()

		const alphaId = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		const alphaCall = app.addCustomActionCall(alphaId, customActionId, { n: exprExpr('$(custom:a)') }, null)
		const betaId = app.createButton({ pageNumber: 1, row: 1, column: 2 })
		const betaCall = app.addCustomActionCall(betaId, customActionId, { n: exprVal(5) }, null)

		await vi.waitFor(() => {
			expect(getCopyValue(app, alphaId, alphaCall, 'double')).toBe(2)
			expect(getCopyValue(app, betaId, betaCall, 'double')).toBe(10)
		})
		const betaCopy = getEntity(app, betaId, betaCall).getTransientChildGroup(CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP)

		// A variable used by one caller's input only changes that caller's copy
		app.registry.variables.custom.setValue('a', 3)
		await vi.waitFor(() => expect(getCopyValue(app, alphaId, alphaCall, 'double')).toBe(6))
		expect(getCopyValue(app, betaId, betaCall, 'double')).toBe(10)

		// As does changing the options of one call
		await app.trpc().controls.entities.setOption({
			controlId: betaId,
			entityLocation: { stepId: getStepId(betaId), setId: 'down' },
			entityId: betaCall,
			key: 'n',
			value: exprVal(7),
		})
		await vi.waitFor(() => expect(getCopyValue(app, betaId, betaCall, 'double')).toBe(14))
		expect(getCopyValue(app, alphaId, alphaCall, 'double')).toBe(6)

		// The copy was updated in place, rather than rebuilt
		expect(getEntity(app, betaId, betaCall).getTransientChildGroup(CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP)).toBe(
			betaCopy
		)
	})

	test('editing a custom action updates the copies held by its callers, and their runs', async () => {
		app.createCustomVariable('out', '')
		const customActionId = await createDoublingCustomAction()

		const location = { pageNumber: 1, row: 1, column: 1 }
		const buttonId = app.createButton(location)
		const callId = app.addCustomActionCall(buttonId, customActionId, { n: exprVal(4) }, null)
		await vi.waitFor(() => expect(getCopyValue(app, buttonId, callId, 'double')).toBe(8))

		// Change what the local variable computes, and add an action
		const localId = getStoredLocalVariableId(customActionId, 'double')
		await app.trpc().controls.entities.setOption({
			controlId: customActionId,
			entityLocation: 'local-variables',
			entityId: localId,
			key: 'expression',
			value: exprVal('$(options:n) * 3'),
		})
		app.addCustomActionAction(customActionId, null, 'custom_variable_set_value', {
			name: exprVal('out'),
			create: exprVal(false),
			value: exprExpr('$(local:double)'),
		})

		await vi.waitFor(() => expect(getCopyValue(app, buttonId, callId, 'double')).toBe(12))

		app.pressButton(location, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('out')).toBe(12))
	})

	test('the inputs given by a caller, and where its outputs go, survive a restart', async () => {
		app.createCustomVariable('res', 0)
		const customActionId = await createDoublingCustomAction()

		const location = { pageNumber: 1, row: 1, column: 1 }
		const buttonId = app.createButton(location)
		const callId = app.addCustomActionCall(
			buttonId,
			customActionId,
			{ n: exprVal(21) },
			{
				result: { type: 'custom-variable', variableName: exprVal('res'), createIfNotExists: false },
			}
		)

		const { configDir } = app
		await app.close()
		app = await createTestApp({ configDir, extraModulePath: null })

		const call = getEntity(app, buttonId, callId)
		expect(call.rawOptions).toEqual({ n: exprVal(21) })
		expect(call.rawOutputTargets).toEqual({
			result: { type: 'custom-variable', variableName: exprVal('res'), createIfNotExists: false },
		})

		// The copy is rebuilt from the restored custom action and inputs
		await vi.waitFor(() => expect(getCopyValue(app, buttonId, callId, 'double')).toBe(42))

		app.pressButton(location, true)
		await vi.waitFor(() => expect(app.getCustomVariableValue('res')).toBe(42))
	})

	test('renaming an input keeps the value given by each caller, after a restart too', async () => {
		const customActionId = await createDoublingCustomAction()

		const buttonId = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		const callId = app.addCustomActionCall(buttonId, customActionId, { n: exprVal(6) }, null)
		await vi.waitFor(() => expect(getCopyValue(app, buttonId, callId, 'double')).toBe(12))

		await app.trpc().controls.customActions.inputUpdate({
			controlId: customActionId,
			inputId: 'n',
			field: { type: 'number', id: 'count', label: 'Count', default: 1, min: -1000, max: 1000 },
		})
		// The local variable still refers to the old id, so point it at the new one
		const localId = getStoredLocalVariableId(customActionId, 'double')
		await app.trpc().controls.entities.setOption({
			controlId: customActionId,
			entityLocation: 'local-variables',
			entityId: localId,
			key: 'expression',
			value: exprVal('$(options:count) * 2'),
		})

		expect(getEntity(app, buttonId, callId).rawOptions).toEqual({ count: exprVal(6) })
		await vi.waitFor(() => expect(getCopyValue(app, buttonId, callId, 'double')).toBe(12))

		const { configDir } = app
		await app.close()
		app = await createTestApp({ configDir, extraModulePath: null })

		expect(getEntity(app, buttonId, callId).rawOptions).toEqual({ count: exprVal(6) })
		await vi.waitFor(() => expect(getCopyValue(app, buttonId, callId, 'double')).toBe(12))
	})

	/** The id of the first step of a button */
	function getStepId(buttonId: SomeControlId): string {
		const control = app.registry.controls.getControl(buttonId)
		if (!control?.supportsEntities) throw new Error('Expected a button')
		return (control.entities as unknown as { getStepIds(): string[] }).getStepIds()[0]
	}
})

describe('custom actions using a connection', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({
			configDir: null,
			extraModulePath: path.join(import.meta.dirname, 'modules/fixtures'),
		})
	})
	afterEach(async () => {
		vi.restoreAllMocks()
		await app.close()
	})

	const label = 'tester'

	/** Add a connection of a test module, once it can run actions */
	async function addConnection(moduleType: string): Promise<string> {
		const connectionId = await app
			.trpc()
			.instances.connections.add({ module: { type: moduleType }, label, versionId: 'dev' })
		if (!connectionId) throw new Error('Failed to add the connection')
		// The definitions are set part way through starting, while the actions of a button would still be dropped
		await vi.waitFor(() => {
			expect(
				app.registry.instance.definitions.getEntityDefinition(EntityModelType.Feedback, connectionId, 'last_value_is')
			).toBeTruthy()
			expect(app.registry.instance.processManager.getConnectionChild(connectionId)).toBeDefined()
		}, 30_000)
		return connectionId
	}

	/**
	 * Create a custom action whose local variable `matches` is whether the last value of the connection is its input
	 * `want`, and which writes that to the custom variable `out`
	 */
	async function createCheckingCustomAction(connectionId: string): Promise<CustomActionControlId> {
		app.createCustomVariable('out', '')
		const customActionId = await app.trpc().controls.customActions.create({ name: 'Check' })
		await app.trpc().controls.customActions.inputAdd({
			controlId: customActionId,
			field: { type: 'textinput', id: 'want', label: 'Want', default: '' },
		})
		const matchesId = await app.trpc().controls.entities.add({
			controlId: customActionId,
			entityLocation: 'local-variables',
			ownerId: null,
			connectionId,
			entityType: EntityModelType.Feedback,
			entityDefinition: 'last_value_is',
		})
		if (!matchesId) throw new Error('Failed to add the local variable')
		await app.trpc().controls.entities.setVariableName({
			controlId: customActionId,
			entityLocation: 'local-variables',
			entityId: matchesId,
			name: 'matches',
		})
		await app.trpc().controls.entities.setOption({
			controlId: customActionId,
			entityLocation: 'local-variables',
			entityId: matchesId,
			key: 'value',
			value: exprExpr('$(options:want)'),
		})
		app.addCustomActionAction(customActionId, null, 'custom_variable_set_value', {
			name: exprVal('out'),
			create: exprVal(false),
			value: exprExpr('$(local:matches)'),
		})
		return customActionId
	}

	/** The id of the first step of a button */
	function getStepId(buttonId: SomeControlId): string {
		const control = app.registry.controls.getControl(buttonId)
		if (!control?.supportsEntities) throw new Error('Expected a button')
		return (control.entities as unknown as { getStepIds(): string[] }).getStepIds()[0]
	}

	/** Add a button which sets the last value of the connection, returning a function to set it with */
	async function addSetter(connectionId: string): Promise<(value: string) => Promise<void>> {
		const setter = { pageNumber: 1, row: 2, column: 1 }
		const setterId = app.createButton(setter)
		const stepId = getStepId(setterId)
		const setVarId = await app.trpc().controls.entities.add({
			controlId: setterId,
			entityLocation: { stepId, setId: 'down' },
			ownerId: null,
			connectionId,
			entityType: EntityModelType.Action,
			entityDefinition: 'set_var',
		})
		if (!setVarId) throw new Error('Failed to add the action')

		return async (value: string) => {
			await app.trpc().controls.entities.setOption({
				controlId: setterId,
				entityLocation: { stepId, setId: 'down' },
				entityId: setVarId,
				key: 'value',
				value: exprVal(value),
			})
			app.pressButton(setter, true)
			app.pressButton(setter, false)
			await vi.waitFor(() => {
				expect(app.registry.variables.values.getVariableValue(label, 'last_value')).toBe(value)
			}, 10_000)
		}
	}

	test('a connection feedback in a custom action sees the inputs of each caller', async () => {
		const connectionId = await addConnection('test-module-2-1-3')
		const customActionId = await createCheckingCustomAction(connectionId)

		// Two buttons, which call it with different inputs
		const alpha = { pageNumber: 1, row: 1, column: 1 }
		app.addCustomActionCall(app.createButton(alpha), customActionId, { want: exprVal('alpha') }, null)
		const beta = { pageNumber: 1, row: 1, column: 2 }
		app.addCustomActionCall(app.createButton(beta), customActionId, { want: exprVal('beta') }, null)

		const setLastValue = await addSetter(connectionId)

		/** Press a button until the custom action reports the expected value, as the connection updates asynchronously */
		const expectPressGives = async (location: typeof alpha, expected: boolean) => {
			await vi.waitFor(async () => {
				app.pressButton(location, true)
				app.pressButton(location, false)
				await new Promise((resolve) => setTimeout(resolve, 20))
				expect(app.getCustomVariableValue('out')).toBe(expected)
			}, 10_000)
		}

		await setLastValue('alpha')
		await expectPressGives(alpha, true)
		await expectPressGives(beta, false)

		await setLastValue('beta')
		await expectPressGives(alpha, false)
		await expectPressGives(beta, true)
	})

	test('a copy sharing a subscription with another has its value, and one with other inputs has its own', async () => {
		const connectionId = await addConnection('test-module-2-1-3')
		const customActionId = await createCheckingCustomAction(connectionId)
		const setLastValue = await addSetter(connectionId)

		const buttonId = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		const firstCall = app.addCustomActionCall(buttonId, customActionId, { want: exprVal('alpha') }, null)
		await setLastValue('alpha')
		await vi.waitFor(() => expect(getCopyValue(app, buttonId, firstCall, 'matches')).toBe(true), 10_000)

		// Another call on the same button with the same input shares the subscription of the first, so has its value
		// though the connection doesn't report it again
		const secondCall = app.addCustomActionCall(buttonId, customActionId, { want: exprVal('alpha') }, null)
		await vi.waitFor(() => expect(getCopyValue(app, buttonId, secondCall, 'matches')).toBe(true))

		// One with a different input has its own subscription, and value
		const otherCall = app.addCustomActionCall(buttonId, customActionId, { want: exprVal('beta') }, null)
		await vi.waitFor(() => expect(getCopyValue(app, buttonId, otherCall, 'matches')).toBe(false), 10_000)
		expect(getCopyValue(app, buttonId, firstCall, 'matches')).toBe(true)
	})

	test('the copy held by a call is subscribed to a connection of an older module when the app starts', async () => {
		// Modules older than 1.13 are sent everything to subscribe when they start, rather than as each is added
		const connectionId = await addConnection('test-module-1-12-1')
		const customActionId = await createCheckingCustomAction(connectionId)
		const setLastValue = await addSetter(connectionId)

		// These modules can't be given expressions, so it checks for a fixed value rather than its input
		const customAction = app.registry.controls.getControl(customActionId)
		if (!(customAction instanceof ControlCustomAction)) throw new Error('Expected a custom action')
		await app.trpc().controls.entities.setOption({
			controlId: customActionId,
			entityLocation: 'local-variables',
			entityId: customAction.entities.getLocalVariableEntities()[0].id,
			key: 'value',
			value: exprVal('alpha'),
		})

		const buttonId = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		const callId = app.addCustomActionCall(buttonId, customActionId, { want: exprVal('alpha') }, null)
		await setLastValue('alpha')
		await vi.waitFor(() => expect(getCopyValue(app, buttonId, callId, 'matches')).toBe(true), 10_000)

		const { configDir } = app
		await app.close()
		app = await createTestApp({ configDir, extraModulePath: path.join(import.meta.dirname, 'modules/fixtures') })
		await vi.waitFor(
			() => expect(app.registry.instance.processManager.getConnectionChild(connectionId)).toBeDefined(),
			30_000
		)

		// The module starts afresh, so only reports the value to what it was told about when it started
		await setLastValue('alpha')
		await vi.waitFor(() => expect(getCopyValue(app, buttonId, callId, 'matches')).toBe(true), 10_000)
	})

	test('the copies held by calls get the values for their own inputs after a restart', async () => {
		const connectionId = await addConnection('test-module-2-1-3')
		const customActionId = await createCheckingCustomAction(connectionId)
		const setLastValue = await addSetter(connectionId)

		const alphaId = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		const alphaCall = app.addCustomActionCall(alphaId, customActionId, { want: exprVal('alpha') }, null)
		const betaId = app.createButton({ pageNumber: 1, row: 1, column: 2 })
		const betaCall = app.addCustomActionCall(betaId, customActionId, { want: exprVal('beta') }, null)
		await setLastValue('alpha')
		await vi.waitFor(() => {
			expect(getCopyValue(app, alphaId, alphaCall, 'matches')).toBe(true)
			expect(getCopyValue(app, betaId, betaCall, 'matches')).toBe(false)
		}, 10_000)

		const { configDir } = app
		await app.close()
		app = await createTestApp({ configDir, extraModulePath: path.join(import.meta.dirname, 'modules/fixtures') })
		await vi.waitFor(
			() => expect(app.registry.instance.processManager.getConnectionChild(connectionId)).toBeDefined(),
			30_000
		)

		// The module starts afresh, without a last value
		await vi.waitFor(() => {
			expect(getCopyValue(app, alphaId, alphaCall, 'matches')).toBe(false)
			expect(getCopyValue(app, betaId, betaCall, 'matches')).toBe(false)
		}, 10_000)
		await vi.waitFor(async () => setLastValue('beta'), 20_000)
		await vi.waitFor(() => {
			expect(getCopyValue(app, alphaId, alphaCall, 'matches')).toBe(false)
			expect(getCopyValue(app, betaId, betaCall, 'matches')).toBe(true)
		}, 10_000)
	})

	test.each(['test-module-2-1-3', 'test-module-1-14-1'])(
		'an upgrade of an action in a custom action of %s upgrades it there, and not the copies held by its calls',
		async (moduleType) => {
			const connectionId = await addConnection(moduleType)
			const customActionId = await app.trpc().controls.customActions.create({ name: 'Old' })
			const setVarId = await app.trpc().controls.entities.add({
				controlId: customActionId,
				entityLocation: 'custom_action_actions',
				ownerId: null,
				connectionId,
				entityType: EntityModelType.Action,
				entityDefinition: 'set_var',
			})
			if (!setVarId) throw new Error('Failed to add the action')
			const first = { pageNumber: 1, row: 1, column: 1 }
			app.addCustomActionCall(app.createButton(first), customActionId, {}, null)
			const second = { pageNumber: 1, row: 1, column: 2 }
			app.addCustomActionCall(app.createButton(second), customActionId, {}, null)

			// An export from before the upgrade script, when set_var had the option `val`
			const res = await app.http.get('/int/export/full?format=json').expect(200)
			const exported = JSON.parse(res.text || res.body.toString())
			exported.instances[connectionId].lastUpgradeIndex = -1
			const exportedAction = exported.customActions[customActionId.slice('custom-action:'.length)].actions.find(
				(action: { id: string }) => action.id === setVarId
			)
			exportedAction.options = { val: exprVal('upgraded') }

			// Legacy modules are talked to through the ipc wrapper of the old base library
			const sent = vi.spyOn(IpcWrapper.prototype, 'sendWithCb')
			const sentLegacy = vi.spyOn(LegacyIpcWrapper.prototype, 'sendWithCb')
			const ctx = createMockTrpcContext()
			ctx.pendingImport = { object: exported, timeout: null }
			await app.trpc(ctx).importExport.importFull({
				config: {
					buttons: 'unchanged',
					surfaces: { known: 'unchanged', instances: 'unchanged', remote: 'unchanged' },
					triggers: 'unchanged',
					customVariables: 'unchanged',
					expressionVariables: 'unchanged',
					customActions: 'reset-and-import',
					connections: 'unchanged',
					userconfig: 'unchanged',
					imageLibrary: 'unchanged',
				},
			})

			// The action in the custom action is upgraded. The import gives it a new id
			const importedAction = () => {
				const customAction = app.registry.controls.getControl(customActionId)
				if (!(customAction instanceof ControlCustomAction)) throw new Error('Expected a custom action')
				return customAction.entities.getActionEntities()[0]
			}
			await vi.waitFor(
				() => expect(importedAction().asEntityModel(false).options).toEqual({ value: exprVal('upgraded') }),
				10_000
			)

			// And the calls run it as upgraded
			const lastValue = () => app.registry.variables.values.getVariableValue(label, 'last_value')
			await vi.waitFor(() => {
				app.pressButton(first, true)
				app.pressButton(first, false)
				expect(lastValue()).toBe('upgraded')
			}, 10_000)

			// Only the action in the custom action was sent to the module to upgrade, not the copies
			const upgradedIds = [...sent.mock.calls, ...sentLegacy.mock.calls]
				// Legacy modules are sent actions and feedbacks to upgrade in one message
				.filter(([name]) => name === 'upgradeActions' || name === 'upgradeActionsAndFeedbacks')
				.flatMap(([, msg]) => (msg as { actions: { id: string }[] }).actions.map((action) => action.id))
			expect(upgradedIds).toEqual([importedAction().id])
		}
	)

	test('a copy rebuilt as the custom action is edited keeps the value from the connection', async () => {
		const connectionId = await addConnection('test-module-2-1-3')
		const customActionId = await createCheckingCustomAction(connectionId)
		const setLastValue = await addSetter(connectionId)

		const buttonId = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		const callId = app.addCustomActionCall(buttonId, customActionId, { want: exprVal('alpha') }, null)
		await setLastValue('alpha')
		await vi.waitFor(() => expect(getCopyValue(app, buttonId, callId, 'matches')).toBe(true), 10_000)
		const copyBefore = getEntity(app, buttonId, callId).getTransientChildGroup(CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP)

		// Editing the custom action rebuilds the copy, with the same subscription as before
		app.addCustomActionAction(customActionId, null, 'wait', { time: exprExpr('1') })
		await vi.waitFor(() =>
			expect(
				getEntity(app, buttonId, callId).getTransientChildGroup(CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP)
			).not.toBe(copyBefore)
		)

		await vi.waitFor(() => expect(getCopyValue(app, buttonId, callId, 'matches')).toBe(true))
	})

	test('changing the input of one caller re-subscribes only its own copy', async () => {
		const connectionId = await addConnection('test-module-2-1-3')
		const customActionId = await createCheckingCustomAction(connectionId)
		const setLastValue = await addSetter(connectionId)

		const alphaId = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		const alphaCall = app.addCustomActionCall(alphaId, customActionId, { want: exprVal('alpha') }, null)
		const betaId = app.createButton({ pageNumber: 1, row: 1, column: 2 })
		const betaCall = app.addCustomActionCall(betaId, customActionId, { want: exprVal('beta') }, null)
		await setLastValue('alpha')
		await vi.waitFor(() => {
			expect(getCopyValue(app, alphaId, alphaCall, 'matches')).toBe(true)
			expect(getCopyValue(app, betaId, betaCall, 'matches')).toBe(false)
		}, 10_000)

		// Building the custom action queued a rebuild of its copies, which must be done before watching what is sent.
		// It is debounced, so wait for the copies to stay the same for a while, which allows for a slow machine
		const copiesOf = () =>
			[
				[alphaId, alphaCall],
				[betaId, betaCall],
			].map(([controlId, callId]) =>
				getEntity(app, controlId as SomeControlId, callId).getTransientChildGroup(
					CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP
				)
			)
		let lastCopies = copiesOf()
		let stableSince = Date.now()
		await vi.waitFor(
			() => {
				const copies = copiesOf()
				if (copies.some((copy, i) => copy !== lastCopies[i])) {
					lastCopies = copies
					stableSince = Date.now()
				}
				expect(Date.now() - stableSince).toBeGreaterThanOrEqual(300)
			},
			{ timeout: 10_000, interval: 20 }
		)
		const alphaCopy = lastCopies[0]

		const updated = vi.spyOn(app.registry.instance.processManager, 'connectionEntityUpdate')
		await app.trpc().controls.entities.setOption({
			controlId: betaId,
			entityLocation: { stepId: getStepId(betaId), setId: 'down' },
			entityId: betaCall,
			key: 'want',
			value: exprVal('alpha'),
		})

		await vi.waitFor(() => expect(getCopyValue(app, betaId, betaCall, 'matches')).toBe(true), 10_000)
		expect(getCopyValue(app, alphaId, alphaCall, 'matches')).toBe(true)
		expect(getEntity(app, alphaId, alphaCall).getTransientChildGroup(CUSTOM_ACTION_COPY_LOCAL_VARIABLES_GROUP)).toBe(
			alphaCopy
		)

		// Only the entities of the copy whose inputs changed were sent to the connection
		const updatedIds = updated.mock.calls.map(([entity]) => entity.id)
		expect(updatedIds.length).toBeGreaterThan(0)
		expect(updatedIds.filter((id) => !id.startsWith(`${betaCall}/`))).toEqual([])
	})

	test('a connection action in a custom action runs with the inputs of each caller', async () => {
		const connectionId = await addConnection('test-module-2-1-3')
		const customActionId = await app.trpc().controls.customActions.create({ name: 'Send' })
		await app.trpc().controls.customActions.inputAdd({
			controlId: customActionId,
			field: { type: 'textinput', id: 'text', label: 'Text', default: '' },
		})
		const sendId = await app.trpc().controls.entities.add({
			controlId: customActionId,
			entityLocation: 'custom_action_actions',
			ownerId: null,
			connectionId,
			entityType: EntityModelType.Action,
			entityDefinition: 'set_var',
		})
		if (!sendId) throw new Error('Failed to add the action')
		await app.trpc().controls.entities.setOption({
			controlId: customActionId,
			entityLocation: 'custom_action_actions',
			entityId: sendId,
			key: 'value',
			value: exprExpr("concat('from ', $(options:text))"),
		})

		const first = { pageNumber: 1, row: 1, column: 1 }
		app.addCustomActionCall(app.createButton(first), customActionId, { text: exprVal('first') }, null)
		const second = { pageNumber: 1, row: 1, column: 2 }
		app.addCustomActionCall(app.createButton(second), customActionId, { text: exprVal('second') }, null)

		const lastValue = () => app.registry.variables.values.getVariableValue(label, 'last_value')
		app.pressButton(first, true)
		await vi.waitFor(() => expect(lastValue()).toBe('from first'), 10_000)
		app.pressButton(second, true)
		await vi.waitFor(() => expect(lastValue()).toBe('from second'), 10_000)
		app.pressButton(first, false)
		app.pressButton(first, true)
		await vi.waitFor(() => expect(lastValue()).toBe('from first'), 10_000)
	})
	test('a connection feedback follows a local variable set by the run, and a while loop waiting on it exits when the device changes', async () => {
		const connectionId = await addConnection('test-module-2-1-3')
		const setLastValue = await addSetter(connectionId)
		app.createCustomVariable('out', '')

		const customActionId = await app.trpc().controls.customActions.create({ name: 'Wait for' })
		await app.trpc().controls.customActions.inputAdd({
			controlId: customActionId,
			field: { type: 'textinput', id: 'want', label: 'Want', default: '' },
		})
		app.addLocalVariable(customActionId, 'want', 'user_value', { startup_value: exprVal('') })
		const matchesId = await app.trpc().controls.entities.add({
			controlId: customActionId,
			entityLocation: 'local-variables',
			ownerId: null,
			connectionId,
			entityType: EntityModelType.Feedback,
			entityDefinition: 'last_value_is',
		})
		if (!matchesId) throw new Error('Failed to add the local variable')
		await app.trpc().controls.entities.setVariableName({
			controlId: customActionId,
			entityLocation: 'local-variables',
			entityId: matchesId,
			name: 'matches',
		})
		await app.trpc().controls.entities.setOption({
			controlId: customActionId,
			entityLocation: 'local-variables',
			entityId: matchesId,
			key: 'value',
			value: exprExpr('$(local:want)'),
		})

		const groupId = app.addCustomActionAction(customActionId, null, 'action_group', {
			execution_mode: exprVal('sequential'),
		})
		const inOrder = { parentId: groupId, childGroup: 'default' }
		// The feedback only asks for the input once the run has set it
		app.addCustomActionAction(customActionId, inOrder, 'local_variable_set_value', {
			location: exprVal('run'),
			name: exprVal('want'),
			value: exprExpr('$(options:want)'),
		})
		const loopId = app.addCustomActionAction(customActionId, inOrder, 'logic_while', {})
		app.addCustomActionChildFeedback(
			customActionId,
			{ parentId: loopId, childGroup: 'condition' },
			'check_expression',
			{
				expression: exprVal('!$(local:matches)'),
			}
		)
		app.addCustomActionAction(customActionId, { parentId: loopId, childGroup: 'actions' }, 'wait', {
			time: exprExpr('20'),
		})
		app.addCustomActionAction(customActionId, inOrder, 'custom_variable_set_value', {
			name: exprVal('out'),
			create: exprVal(false),
			value: exprVal('done'),
		})

		await setLastValue('other')
		const location = { pageNumber: 1, row: 1, column: 1 }
		app.addCustomActionCall(app.createButton(location), customActionId, { want: exprVal('alpha') }, null)
		app.pressButton(location, true)
		await new Promise((resolve) => setTimeout(resolve, 300))
		expect(app.getCustomVariableValue('out')).toBe('')

		await setLastValue('alpha')
		await vi.waitFor(() => expect(app.getCustomVariableValue('out')).toBe('done'), 2_000)
	})

	test('a run does not subscribe anything new with the connection, when it has the inputs of the copy', async () => {
		const connectionId = await addConnection('test-module-2-1-3')
		const customActionId = await createCheckingCustomAction(connectionId)
		const setLastValue = await addSetter(connectionId)

		const location = { pageNumber: 1, row: 1, column: 1 }
		const buttonId = app.createButton(location)
		const callId = app.addCustomActionCall(buttonId, customActionId, { want: exprVal('alpha') }, null)
		await setLastValue('alpha')
		await vi.waitFor(() => expect(getCopyValue(app, buttonId, callId, 'matches')).toBe(true), 10_000)
		// Let any rebuild of the copy settle
		await new Promise((resolve) => setTimeout(resolve, 500))

		const sent = vi.spyOn(IpcWrapper.prototype, 'sendWithCb')
		for (let i = 0; i < 3; i++) {
			app.registry.variables.custom.setValue('out', '')
			app.pressButton(location, true)
			app.pressButton(location, false)
			await vi.waitFor(() => expect(app.getCustomVariableValue('out')).toBe(true))
		}
		await new Promise((resolve) => setTimeout(resolve, 300))

		const subscribing = () => sent.mock.calls.filter(([name]) => name === 'updateFeedbacks' || name === 'updateActions')
		expect(subscribing()).toEqual([])

		// Whereas new inputs for the copy are sent
		getEntity(app, buttonId, callId).setOptions({ want: exprVal('beta') })
		await vi.waitFor(() => expect(subscribing().length).toBeGreaterThan(0))
	})

	test('a button calling a custom action shows the error of a connection used inside it', async () => {
		const connectionId = await addConnection('test-module-2-1-3')
		const customActionId = await createCheckingCustomAction(connectionId)

		const callerId = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		app.addCustomActionCall(callerId, customActionId, { want: exprVal('alpha') }, null)
		const otherId = app.createButton({ pageNumber: 1, row: 1, column: 2 })
		app.addInternalAction(otherId, 'wait', { time: exprExpr('1') })

		const statusOf = (controlId: SomeControlId) => (app.registry.controls.getControl(controlId) as any)?.button_status
		await vi.waitFor(() => expect(statusOf(callerId)).toBe('good'))

		app.registry.instance.status.updateInstanceStatus(connectionId, 'connection_failure', 'Broken')
		await vi.waitFor(() => expect(statusOf(callerId)).toBe('error'))
		expect(statusOf(otherId)).toBe('good')
	})

	test('the copies get their values again after the connection is disabled and enabled', async () => {
		const connectionId = await addConnection('test-module-2-1-3')
		const customActionId = await createCheckingCustomAction(connectionId)
		const setLastValue = await addSetter(connectionId)

		const buttonId = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		const callId = app.addCustomActionCall(buttonId, customActionId, { want: exprVal('alpha') }, null)
		await setLastValue('alpha')
		await vi.waitFor(() => expect(getCopyValue(app, buttonId, callId, 'matches')).toBe(true), 10_000)

		await app.trpc().instances.connections.setEnabled({ connectionId, enabled: false })
		await vi.waitFor(() =>
			expect(app.registry.instance.processManager.getConnectionChild(connectionId)).toBeUndefined()
		)
		await app.trpc().instances.connections.setEnabled({ connectionId, enabled: true })
		await vi.waitFor(
			() => expect(app.registry.instance.processManager.getConnectionChild(connectionId)).toBeDefined(),
			30_000
		)

		// The module starts afresh, so knows no last value until it is set again
		await vi.waitFor(() => expect(getCopyValue(app, buttonId, callId, 'matches')).toBe(false), 10_000)
		await vi.waitFor(async () => setLastValue('alpha'), 20_000)
		await vi.waitFor(() => expect(getCopyValue(app, buttonId, callId, 'matches')).toBe(true), 10_000)
	})
})
