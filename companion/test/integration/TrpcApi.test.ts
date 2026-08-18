import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import type { ControlButtonLayered } from '../../lib/Controls/ControlTypes/Button/Layered.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

describe('editing over trpc, as the ui does', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null })
	})
	afterEach(async () => {
		await app.close()
	})

	test('create a button and edit its text element, rendered by the real graphics pipeline', async () => {
		const location = { pageNumber: 1, row: 1, column: 1 }
		await app.trpc().controls.resetControl({ location, newType: 'button-layered' })

		const controlId = app.registry.page.store.getControlIdAt(location)
		expect(controlId).toBeTruthy()

		await app.trpc().controls.styles.updateOption({
			controlId: controlId!,
			elementId: 'text0',
			key: 'text',
			value: exprVal('Hello'),
		})

		// The model reflects the edit
		const control = app.registry.controls.getControl(controlId!) as ControlButtonLayered
		expect(control.drawing.getElementById('text0')).toMatchObject({ text: { isExpression: false, value: 'Hello' } })

		// And the real (in-process) renderer draws it
		await vi.waitFor(() => {
			const render = app.registry.graphics.getCachedRender(location)
			expect(render?.style).toMatchObject({ text: { text: 'Hello' } })
		})
	})

	test('add and configure an action entity, then press the button', async () => {
		app.createCustomVariable('result', 'initial')

		const location = { pageNumber: 1, row: 1, column: 1 }
		const controlId = app.createButton(location)
		const control = app.registry.controls.getControl(controlId) as ControlButtonLayered
		const stepId = control.entities.getStepIds()[0]

		const entityId = await app.trpc().controls.entities.add({
			controlId,
			entityLocation: { stepId, setId: 'down' },
			ownerId: null,
			connectionId: 'internal',
			entityType: EntityModelType.Action,
			entityDefinition: 'custom_variable_set_value',
		})
		expect(entityId).toBeTruthy()

		for (const [key, value] of [
			['name', exprVal('result')],
			['value', exprVal('set via trpc')],
		] as const) {
			await app.trpc().controls.entities.setOption({
				controlId,
				entityLocation: { stepId, setId: 'down' },
				entityId: entityId!,
				key,
				value,
			})
		}

		app.pressButton(location, true)
		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('result')).toBe('set via trpc')
		})
	})

	test('page management', async () => {
		await app.trpc().pages.insert({ asPageNumber: 2, pageNames: ['Second'] })
		expect(app.registry.page.store.getPageInfo(2)?.name).toBe('Second')

		// The new page got its default navigation buttons
		expect(app.registry.page.store.getControlIdAt({ pageNumber: 2, row: 0, column: 0 })).toBeTruthy() // pageup
		expect(app.registry.page.store.getControlIdAt({ pageNumber: 2, row: 1, column: 0 })).toBeTruthy() // pagenum
		expect(app.registry.page.store.getControlIdAt({ pageNumber: 2, row: 2, column: 0 })).toBeTruthy() // pagedown

		await app.trpc().pages.setName({ pageNumber: 2, name: 'Renamed' })
		expect(app.registry.page.store.getPageInfo(2)?.name).toBe('Renamed')

		await app.trpc().pages.remove({ pageNumber: 2 })
		expect(app.registry.page.store.getPageInfo(2)).toBeUndefined()

		// The last remaining page cannot be removed
		expect(await app.trpc().pages.remove({ pageNumber: 1 })).toBe('fail')
	})

	test('custom variable lifecycle', async () => {
		await app.trpc().customVariables.create({ name: 'cv', defaultVal: 'default-value' })
		expect(app.getCustomVariableValue('cv')).toBe('default-value')

		await app.trpc().customVariables.setCurrent({ name: 'cv', value: 'current-value' })
		expect(app.getCustomVariableValue('cv')).toBe('current-value')

		await app.trpc().customVariables.delete({ name: 'cv' })
		expect(app.registry.variables.custom.hasCustomVariable('cv')).toBe(false)
	})
})
