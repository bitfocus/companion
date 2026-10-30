import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { exprExpr, exprVal } from '@companion-app/shared/Model/Options.js'
import { createMockTrpcContext } from '../Util.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

describe('custom actions', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })
	})
	afterEach(async () => {
		await app.close()
	})

	/** Create a custom action which writes its `text` input, with a suffix, to the custom variable `out` */
	async function createWritingCustomAction(): Promise<string> {
		const controlId = await app.trpc().controls.customActions.create({ name: 'Write' })
		await app.trpc().controls.customActions.inputAdd({
			controlId,
			field: { type: 'textinput', id: 'text', label: 'Text', default: 'default' },
		})
		app.addCustomActionAction(controlId, 'custom_variable_set_value', {
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
		app.addCustomActionAction(customActionId, 'wait', { time: exprExpr('300') })
		app.addCustomActionAction(customActionId, 'custom_variable_set_value', {
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
		app.addCustomActionAction(customActionId, 'local_variable_set_value', {
			location: exprVal('this'),
			name: exprVal('doubled'),
			value: exprExpr('$(options:n) * 2'),
		})
		await app.trpc().controls.customActions.outputAdd({
			controlId: customActionId,
			output: { id: 'doubled', label: 'Doubled', variableName: 'doubled' },
		})

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
				customFeedbacks: 'unchanged',
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
		await app.close()
	})

	test('a connection feedback in a custom action sees the inputs of each caller', async () => {
		const label = 'tester'
		const connectionId = await app
			.trpc()
			.instances.connections.add({ module: { type: 'test-module-2-1-3' }, label, versionId: 'dev' })
		if (!connectionId) throw new Error('Failed to add the connection')
		await vi.waitFor(() => {
			expect(
				app.registry.instance.definitions.getEntityDefinition(EntityModelType.Feedback, connectionId, 'last_value_is')
			).toBeTruthy()
		}, 30_000)

		// A custom action which reports whether the last value of the connection is its input
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
		app.addCustomActionAction(customActionId, 'custom_variable_set_value', {
			name: exprVal('out'),
			create: exprVal(false),
			value: exprExpr('$(local:matches)'),
		})

		// Two buttons, which call it with different inputs
		const alpha = { pageNumber: 1, row: 1, column: 1 }
		app.addCustomActionCall(app.createButton(alpha), customActionId, { want: exprVal('alpha') }, null)
		const beta = { pageNumber: 1, row: 1, column: 2 }
		app.addCustomActionCall(app.createButton(beta), customActionId, { want: exprVal('beta') }, null)

		// A button which sets the last value of the connection
		const setter = { pageNumber: 1, row: 2, column: 1 }
		const setterId = app.createButton(setter)
		const setterControl = app.registry.controls.getControl(setterId)
		if (!setterControl?.supportsEntities || !setterControl.entities.isEditable) throw new Error('Expected a button')
		const stepId = (setterControl.entities as unknown as { getStepIds(): string[] }).getStepIds()[0]
		const setVarId = await app.trpc().controls.entities.add({
			controlId: setterId,
			entityLocation: { stepId, setId: 'down' },
			ownerId: null,
			connectionId,
			entityType: EntityModelType.Action,
			entityDefinition: 'set_var',
		})
		if (!setVarId) throw new Error('Failed to add the action')

		const setLastValue = async (value: string) => {
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
})
