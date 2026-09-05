import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

const EMULATOR_ID = 'emulator:test'

describe('emulator surfaces', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })
		app.registry.surfaces.addEmulator('test', 'Test')
	})
	afterEach(async () => {
		await app.close()
	})

	function surfacePageNumber(): number | null {
		const pageId = app.registry.surfaces.devicePageGet(EMULATOR_ID)
		if (!pageId) return null
		return app.registry.page.store.getPageNumber(pageId)
	}

	async function emulatorPress(column: number, row: number): Promise<void> {
		await app.trpc().surfaces.emulatorPressed({ id: 'test', column, row, pressed: true })
		await app.trpc().surfaces.emulatorPressed({ id: 'test', column, row, pressed: false })
	}

	test('pressing an emulator key runs the actions of the button at that location', async () => {
		app.createCustomVariable('result', 'initial')

		const controlId = app.createButton({ pageNumber: 1, row: 1, column: 2 })
		app.addInternalAction(controlId, 'custom_variable_set_value', {
			name: exprVal('result'),
			create: exprVal(false),
			value: exprVal('pressed via emulator'),
		})

		expect(surfacePageNumber()).toBe(1)
		await emulatorPress(2, 1)

		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('result')).toBe('pressed via emulator')
		})
	})

	test('internal page actions move the surface, and the emulator follows the page', async () => {
		app.createCustomVariable('result', 'initial')

		await app.trpc().pages.insert({ asPageNumber: 2, pageNames: ['Second'] })

		// A button on page 1 that sends the emulator to the next page
		const incControlId = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		app.addInternalAction(incControlId, 'inc_page', {
			surfaceId: exprVal(EMULATOR_ID),
		})

		// A button at the same coordinates on page 2
		const page2ControlId = app.createButton({ pageNumber: 2, row: 1, column: 1 })
		app.addInternalAction(page2ControlId, 'custom_variable_set_value', {
			name: exprVal('result'),
			create: exprVal(false),
			value: exprVal('pressed on page 2'),
		})
		// And it sends its own surface back to the previous page
		app.addInternalAction(page2ControlId, 'dec_page', {
			surfaceId: exprVal('self'),
		})

		expect(surfacePageNumber()).toBe(1)

		// Pressing the page-1 button (from any surface) moves the emulator to page 2
		app.pressButton({ pageNumber: 1, row: 1, column: 1 }, true)
		await vi.waitFor(() => {
			expect(surfacePageNumber()).toBe(2)
		})

		// The same emulator key now hits the page-2 button, whose 'self' action brings it back
		await emulatorPress(1, 1)
		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('result')).toBe('pressed on page 2')
			expect(surfacePageNumber()).toBe(1)
		})
	})

	test('surface_on_page feedback follows the surface page', async () => {
		await app.trpc().pages.insert({ asPageNumber: 2, pageNames: ['Second'] })

		const controlId = app.createButton({ pageNumber: 1, row: 2, column: 3 })
		const feedbackId = app.addInternalFeedback(controlId, 'surface_on_page', {
			surfaceId: exprVal(EMULATOR_ID),
			page: exprVal(2),
		})

		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controlId, feedbackId)).toBe(false)
		})

		app.registry.surfaces.devicePageSet(EMULATOR_ID, '+1')
		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controlId, feedbackId)).toBe(true)
		})

		app.registry.surfaces.devicePageSet(EMULATOR_ID, '-1')
		await vi.waitFor(() => {
			expect(app.getFeedbackValue(controlId, feedbackId)).toBe(false)
		})
	})

	test('page history navigation redraws immediately, other page changes are deferred', async () => {
		await app.trpc().pages.insert({ asPageNumber: 2, pageNames: ['Second'] })

		const controlId = app.createButton({ pageNumber: 1, row: 2, column: 4 })
		app.addInternalAction(controlId, 'set_page', {
			surfaceId: exprVal(EMULATOR_ID),
			page: exprVal(2),
		})
		app.addInternalAction(controlId, 'set_page', {
			surfaceId: exprVal(EMULATOR_ID),
			page: exprVal('back'),
		})

		const devicePageSetSpy = vi.spyOn(app.registry.surfaces, 'devicePageSet')

		app.pressButton({ pageNumber: 1, row: 2, column: 4 }, true)

		await vi.waitFor(() => {
			expect(devicePageSetSpy).toHaveBeenCalledTimes(2)
		})

		// An absolute page change defers the redraw, history navigation ('back'/'forward') does not
		expect(devicePageSetSpy).toHaveBeenNthCalledWith(1, EMULATOR_ID, expect.any(String), true, true)
		expect(devicePageSetSpy).toHaveBeenNthCalledWith(2, EMULATOR_ID, 'back', true, false)
	})

	test('the rescanUsb mutation reports errors instead of throwing', async () => {
		// In this environment the scan may find nothing or fail outright - either way the mutation
		// must resolve (a failure is returned as an error string, not thrown)
		await expect(app.trpc().surfaces.rescanUsb()).resolves.not.toThrow()
	})
})
