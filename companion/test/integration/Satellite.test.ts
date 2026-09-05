import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import LogController from '../../lib/Log/Controller.js'
import { SatelliteSocketWrapper, type SatelliteInitSocketResult } from '../../lib/Service/Satellite/SatelliteApi.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

/** An in-process stand-in for the tcp/websocket transports, capturing everything the server sends */
class TestSocketWrapper extends SatelliteSocketWrapper {
	readonly remoteAddress = '127.0.0.1'
	readonly lines: string[] = []
	destroyed = false

	protected write(data: string): void {
		this.lines.push(data.trimEnd())
	}

	destroy(): void {
		this.destroyed = true
	}
}

describe('satellite surface protocol', () => {
	let app: TestApp
	let socket: TestSocketWrapper
	let connection: SatelliteInitSocketResult

	beforeEach(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })

		socket = new TestSocketWrapper()
		connection = app.registry.services.satelliteApi.initSocket(LogController.createLogger('test/satellite'), socket)
	})
	afterEach(async () => {
		connection.cleanupDevices()
		await app.close()
	})

	async function addDevice(extraArgs: string): Promise<void> {
		connection.processMessage(`ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="TestProduct" ${extraArgs}\n`)
		await vi.waitFor(() => {
			expect(socket.lines).toContainEqual(expect.stringMatching(/^ADD-DEVICE OK DEVICEID="dev1"/))
		})
	}

	test('the handshake announces the api version and registers the device as a surface', async () => {
		expect(socket.lines[0]).toMatch(/^BEGIN CompanionVersion=".+" ApiVersion="\d+\.\d+\.\d+"/)
		expect(socket.lines[1]).toMatch(/^CAPS /)

		await addDevice('KEYS_TOTAL=8 KEYS_PER_ROW=4')

		// The surface exists in the surface controller under its deviceId, on page 1
		const pageId = app.registry.surfaces.devicePageGet('dev1')
		expect(pageId).toBeTruthy()
		expect(app.registry.page.store.getPageNumber(pageId!)).toBe(1)

		// And the protocol stays responsive
		connection.processMessage('PING hello\n')
		await vi.waitFor(() => {
			expect(socket.lines).toContain('PONG hello')
		})
	})

	test('a key press runs the actions of the button at that location', async () => {
		app.createCustomVariable('sat_var', 'initial')

		const controlId = app.createButton({ pageNumber: 1, row: 1, column: 2 })
		app.addInternalAction(controlId, 'custom_variable_set_value', {
			name: exprVal('sat_var'),
			create: exprVal(false),
			value: exprVal('pressed via satellite'),
		})

		await addDevice('KEYS_TOTAL=8 KEYS_PER_ROW=4')

		connection.processMessage('KEY-PRESS DEVICEID="dev1" KEY=1/2 PRESSED=1\n')
		connection.processMessage('KEY-PRESS DEVICEID="dev1" KEY=1/2 PRESSED=0\n')

		await vi.waitFor(() => {
			expect(socket.lines).toContainEqual(expect.stringMatching(/^KEY-PRESS OK/))
			expect(app.getCustomVariableValue('sat_var')).toBe('pressed via satellite')
		})
	})

	test('button renders are streamed as key-state messages', async () => {
		const location = { pageNumber: 1, row: 0, column: 1 }
		const controlId = app.createButton(location)
		await app.trpc().controls.styles.updateOption({
			controlId,
			elementId: 'text0',
			key: 'text',
			value: exprVal('SatText'),
		})

		await addDevice('KEYS_TOTAL=8 KEYS_PER_ROW=4 COLORS=hex TEXT=1')

		// The draws stream in asynchronously, rendered in-process. The cell may be drawn again once
		// the render of the new text completes, so assert on the latest state of the cell
		const textBase64 = Buffer.from('SatText').toString('base64')
		await vi.waitFor(() => {
			const keyState = socket.lines
				.filter((line) => line.startsWith('KEY-STATE') && line.includes('LOCATION="1/0/1"'))
				.at(-1)
			expect(keyState).toBeTruthy()
			expect(keyState).toContain('TYPE="BUTTON"')
			expect(keyState).toContain(`TEXT="${textBase64}"`)
			expect(keyState).toMatch(/COLOR="#[0-9a-f]{6}"/)
		})
	})

	test('removing the device removes the surface', async () => {
		await addDevice('KEYS_TOTAL=8 KEYS_PER_ROW=4')
		expect(app.registry.surfaces.devicePageGet('dev1')).toBeTruthy()

		connection.processMessage('REMOVE-DEVICE DEVICEID="dev1"\n')
		await vi.waitFor(() => {
			expect(app.registry.surfaces.devicePageGet('dev1')).toBeUndefined()
		})
	})
})
