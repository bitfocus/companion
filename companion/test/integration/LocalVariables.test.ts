import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ControlLocationOption } from '@companion-app/shared/ControlLocation.js'
import { EntityModelType, type SomeSocketEntityLocation } from '@companion-app/shared/Model/EntityModel.js'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import type { ControlButtonLayered } from '../../lib/Controls/ControlTypes/Button/Layered.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

describe('local variable actions', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })
	})
	afterEach(async () => {
		// createTestApp() may have rejected before assigning, so guard so teardown can't mask that error
		await app?.close()
	})

	/** Add a local variable through trpc, as the webui does */
	async function addLocalVariable(controlId: string, name: string): Promise<string> {
		const entityId = await app.trpc().controls.entities.add({
			controlId,
			entityLocation: 'local-variables',
			ownerId: null,
			connectionId: 'internal',
			entityType: EntityModelType.Feedback,
			entityDefinition: 'user_value',
		})
		expect(entityId).toBeTruthy()
		await app.trpc().controls.entities.setVariableName({
			controlId,
			entityLocation: 'local-variables',
			entityId: entityId!,
			name,
		})
		return entityId!
	}

	/** Add a `local_variable_set_value` action through trpc, leaving its location at the default */
	async function addSetValueAction(
		controlId: string,
		entityLocation: SomeSocketEntityLocation,
		name: string,
		value: string
	): Promise<string> {
		const entityId = await app.trpc().controls.entities.add({
			controlId,
			entityLocation,
			ownerId: null,
			connectionId: 'internal',
			entityType: EntityModelType.Action,
			entityDefinition: 'local_variable_set_value',
		})
		expect(entityId).toBeTruthy()
		for (const [key, val] of [
			['name', exprVal(name)],
			['value', exprVal(value)],
		] as const) {
			await app.trpc().controls.entities.setOption({ controlId, entityLocation, entityId: entityId!, key, value: val })
		}
		return entityId!
	}

	function getLocation(controlId: string, entityId: string) {
		const control = app.registry.controls.getControl(controlId)
		if (!control?.supportsEntities) throw new Error(`Control "${controlId}" has no entities`)
		return control.entities.findEntityById(entityId)?.rawOptions.location
	}

	test('on a trigger, defaults to `this` and sets the trigger own variable', async () => {
		const triggerId = await app.trpc().controls.triggers.create()
		const variableId = await addLocalVariable(triggerId, 'result')
		const actionId = await addSetValueAction(triggerId, 'trigger_actions', 'result', 'from trigger')

		expect(getLocation(triggerId, actionId)).toEqual(exprVal('this'))

		await app.trpc().controls.triggers.testActions({ controlId: triggerId })
		await vi.waitFor(() => {
			expect(app.getFeedbackValue(triggerId, variableId)).toBe('from trigger')
		})
	})

	test('on a button, defaults to the grid location and sets the button own variable', async () => {
		const location = { pageNumber: 1, row: 1, column: 1 }
		const controlId = app.createButton(location)
		const control = app.registry.controls.getControl(controlId) as ControlButtonLayered
		const downSet = { stepId: control.entities.getStepIds()[0], setId: 'down' } as const

		const variableId = await addLocalVariable(controlId, 'result')
		const actionId = await addSetValueAction(controlId, downSet, 'result', 'from button')

		expect(getLocation(controlId, actionId)).toEqual(exprVal(ControlLocationOption.default))

		app.pressButton(location, true)
		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controlId, variableId)).toBe('from button')
		})
	})
})
