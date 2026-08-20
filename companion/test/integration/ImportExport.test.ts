import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import { createMockTrpcContext } from '../Util.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

describe('export and import', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })
	})
	afterEach(async () => {
		await app.close()
	})

	test('a full json export can be imported back, restoring the config', async () => {
		// Build some config worth exporting
		app.createCustomVariable('kept', 'v1')
		await app.trpc().pages.setName({ pageNumber: 1, name: 'MyPage' })

		const location = { pageNumber: 1, row: 1, column: 1 }
		const controlId = app.createButton(location)
		app.addInternalAction(controlId, 'custom_variable_set_value', {
			name: exprVal('kept'),
			create: exprVal(false),
			value: exprVal('pressed'),
		})

		// Export over the internal http api. The format must be explicit - the default is gzipped
		const res = await app.http.get('/int/export/full?format=json').expect(200)
		const exported = JSON.parse(res.text || res.body.toString())
		expect(exported.type).toBe('full')

		// Wreck the config
		app.registry.variables.custom.deleteVariable('kept')
		await app.trpc().controls.resetControl({ location })
		await app.trpc().pages.setName({ pageNumber: 1, name: 'Wrecked' })
		expect(app.registry.page.store.getControlIdAt(location)).toBeFalsy()

		// Import the export back. The pending import normally arrives via a multipart upload; it lives
		// on the trpc context, so hand it to a caller directly
		const ctx = createMockTrpcContext()
		ctx.pendingImport = { object: exported, timeout: null }
		await app.trpc(ctx).importExport.importFull({
			config: {
				buttons: 'reset-and-import',
				surfaces: { known: 'reset-and-import', instances: 'reset-and-import', remote: 'reset-and-import' },
				triggers: 'reset-and-import',
				customVariables: 'reset-and-import',
				expressionVariables: 'reset-and-import',
				connections: 'reset',
				// Keep the userconfig - a reset would restore the defaults and undo the harness overrides
				// (usb hotplug, mdns, usage statistics)
				userconfig: 'unchanged',
				imageLibrary: 'reset-and-import',
			},
		})

		// The config is restored
		expect(app.registry.page.store.getPageInfo(1)?.name).toBe('MyPage')
		expect(app.getCustomVariableValue('kept')).toBe('v1')

		// And the restored button still works
		app.pressButton(location, true)
		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('kept')).toBe('pressed')
		})
	})
})
