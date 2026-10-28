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

	test('the result of a custom action is stored by the caller', async () => {
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
		await app.trpc().controls.setOptionsField({ controlId: customActionId, key: 'resultVariable', value: 'doubled' })

		const location = { pageNumber: 1, row: 2, column: 1 }
		const buttonId = app.createButton(location)
		const callId = app.addCustomActionCall(
			buttonId,
			customActionId,
			{ n: exprVal(21) },
			{
				type: 'custom-variable',
				variableName: exprVal('res'),
				createIfNotExists: false,
			}
		)

		// Where to store the result is resolved asynchronously
		await vi.waitFor(() => {
			const control = app.registry.controls.getControl(buttonId)
			expect(control?.supportsEntities && control.entities.findEntityById(callId)?.storeResult).toBeTruthy()
		})

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
