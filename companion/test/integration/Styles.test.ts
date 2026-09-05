import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ControlButtonLayered } from '../../lib/Controls/ControlTypes/Button/Layered.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

describe('legacy style api', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })
	})
	afterEach(async () => {
		await app.close()
	})

	test('style changes are ignored until canModifyStyleInApis is enabled', async () => {
		const controlId = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		const control = app.registry.controls.getControl(controlId) as ControlButtonLayered

		// The gate defaults to off: the endpoint responds ok but changes nothing
		await app.http.post('/api/location/1/1/1/style?text=Nope').expect(200)
		expect(control.drawing.getElementById('text0')).toMatchObject({ text: { isExpression: false, value: '' } })

		await app.trpc().controls.setOptionsField({ controlId, key: 'canModifyStyleInApis', value: true })

		// text maps onto the text element, bgcolor onto the background box element
		await app.http.post('/api/location/1/1/1/style?text=Hi&bgcolor=%23ff0000').expect(200)
		expect(control.drawing.getElementById('text0')).toMatchObject({ text: { isExpression: false, value: 'Hi' } })
		expect(control.drawing.getElementById('box0')).toMatchObject({ color: { isExpression: false, value: 0xff0000 } })
	})
})
