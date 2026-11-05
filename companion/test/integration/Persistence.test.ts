import { afterEach, describe, expect, test, vi } from 'vitest'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 60_000, hookTimeout: 30_000 })

describe('config persistence across restarts', () => {
	let app: TestApp | undefined
	afterEach(async () => {
		await app?.close()
		app = undefined
	})

	test('controls and custom variables survive a restart', async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })

		app.createCustomVariable('persisted', 'startup-value')
		app.registry.variables.custom.setValue('persisted', 'changed-value')

		const location = { pageNumber: 1, row: 1, column: 1 }
		const controlId = app.createButton(location)
		app.addInternalAction(controlId, 'custom_variable_set_value', {
			name: exprVal('persisted'),
			create: exprVal(false),
			value: exprVal('pressed after restart'),
		})

		const { configDir } = app
		await app.close()

		// Boot a second app from the same config directory
		const restarted = await createTestApp({ configDir, extraModulePath: null })
		app = restarted

		// The control rehydrated at its location with its entities
		const rehydratedControlId = restarted.registry.page.store.getControlIdAt(location)
		expect(rehydratedControlId).toBe(controlId)

		// The custom variable definition persisted, and its value reset to the startup value
		// (persistCurrentValue defaults to false)
		expect(restarted.getCustomVariableValue('persisted')).toBe('startup-value')

		// Pressing the restored button still runs its restored action
		restarted.pressButton(location, true)
		await vi.waitFor(() => {
			expect(restarted.getCustomVariableValue('persisted')).toBe('pressed after restart')
		})
	})

	test('closing the app removes the process listeners it added', async () => {
		// As when developing modules, which adds a listener for module reloads
		vi.stubEnv('COMPANION_DEV_MODULES', '/nonexistent')
		try {
			const before = process.listenerCount('message')

			app = await createTestApp({ configDir: null, extraModulePath: null })
			expect(process.listenerCount('message')).toBe(before + 1)

			await app.close()
			app = undefined
			expect(process.listenerCount('message')).toBe(before)
		} finally {
			vi.unstubAllEnvs()
		}
	})
})
