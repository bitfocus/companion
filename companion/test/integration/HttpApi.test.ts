import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

describe('http api', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })
	})
	afterEach(async () => {
		await app.close()
	})

	test('pressing a button over http runs its actions', async () => {
		app.createCustomVariable('result', 'initial')

		const controlId = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		app.addInternalAction(controlId, 'custom_variable_set_value', {
			name: exprVal('result'),
			create: exprVal(false),
			value: exprVal('pressed over http'),
		})

		await app.http.post('/api/location/1/1/1/press').expect(200)

		await vi.waitFor(() => {
			expect(app.getCustomVariableValue('result')).toBe('pressed over http')
		})
	})

	test('custom variables round-trip over http', async () => {
		app.createCustomVariable('foo', 'initial')

		await app.http.post('/api/custom-variable/foo/value?value=changed').expect(200)
		expect(app.getCustomVariableValue('foo')).toBe('changed')

		const res = await app.http.get('/api/custom-variable/foo/value').expect(200)
		expect(res.text).toBe('changed')
	})

	test('an unknown custom variable returns an error status', async () => {
		await app.http.post('/api/custom-variable/does-not-exist/value?value=x').expect(404)
	})

	test('the legacy api only responds once enabled in the userconfig', async () => {
		app.createCustomVariable('foo', 'initial')

		// Disabled by default: the request falls through to the webui catch-all
		await app.http.get('/set/custom-variable/foo?value=legacy')
		expect(app.getCustomVariableValue('foo')).toBe('initial')

		app.registry.userconfig.setKey('http_legacy_api_enabled', true)

		await app.http.get('/set/custom-variable/foo?value=legacy').expect(200)
		expect(app.getCustomVariableValue('foo')).toBe('legacy')
	})
})
