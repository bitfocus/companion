import { describe, test, expect, vi } from 'vitest'
import { mock, mockDeep } from 'vitest-mock-extended'
import { ServiceSatelliteApi, SatelliteSocketWrapper } from '../../../lib/Service/Satellite/SatelliteApi.js'
import type { ServiceApi } from '../../../lib/Service/ServiceApi.js'
import type { SurfaceController } from '../../../lib/Surface/Controller.js'
import type { SurfaceIPSatellite } from '../../../lib/Surface/IP/Satellite.js'
import type { Logger } from '../../../lib/Log/Controller.js'
import type { ImageResult } from '../../../lib/Graphics/ImageResult.js'
import type { DataUserConfig } from '../../../lib/Data/UserConfig.js'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

// Concrete test implementation of the abstract SatelliteSocketWrapper
class TestSocketWrapper extends SatelliteSocketWrapper {
	readonly remoteAddress = '127.0.0.1'
	readonly writtenData: string[] = []
	destroyed = false

	protected write(data: string): void {
		this.writtenData.push(data)
	}

	destroy(): void {
		this.destroyed = true
	}

	/** Return all messages sent, parsed into name + raw string */
	get lastMessage(): string | undefined {
		return this.writtenData.at(-1)
	}

	clearMessages(): void {
		this.writtenData.length = 0
	}
}

function createService({ subscriptionsEnabled = false }: { subscriptionsEnabled?: boolean } = {}) {
	const serviceApi = mockDeep<ServiceApi>(mockOptions)
	const surfaceController = mockDeep<SurfaceController>(mockOptions)
	const userconfig = mockDeep<DataUserConfig>(mockOptions)

	serviceApi.appInfo.appBuild = 'test-build-123'
	userconfig.getKey.mockReturnValue(subscriptionsEnabled)

	const api = new ServiceSatelliteApi(serviceApi, surfaceController, userconfig)
	const logger = mock<Logger>({
		info: vi.fn(),
		debug: vi.fn(),
		silly: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	})

	return { serviceApi, surfaceController, userconfig, api, logger }
}

function createSocketAndInit(api: ServiceSatelliteApi, logger: Logger) {
	const socket = new TestSocketWrapper()
	const result = api.initSocket(logger, socket)
	// Clear the BEGIN message that initSocket sends
	socket.clearMessages()
	return { socket, ...result }
}

function addDeviceToSocket(
	api: ServiceSatelliteApi,
	logger: Logger,
	surfaceController: ReturnType<typeof createService>['surfaceController'],
	socket: TestSocketWrapper,
	processMessage: (data: string) => void,
	deviceId: string,
	opts: { surfaceManifestFromClient?: boolean } = {}
) {
	const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
	Object.defineProperty(mockDevice, 'surfaceManifestFromClient', { value: opts.surfaceManifestFromClient ?? false })
	Object.defineProperty(mockDevice, 'info', { value: { surfaceId: deviceId }, configurable: true })
	surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

	processMessage(`ADD-DEVICE DEVICEID="${deviceId}" PRODUCT_NAME="TestProduct"\n`)
	socket.clearMessages()

	return mockDevice
}

describe('ServiceSatelliteApi', () => {
	describe('initSocket', () => {
		test('sends BEGIN and CAPS messages', () => {
			const { api, logger } = createService()
			const socket = new TestSocketWrapper()

			api.initSocket(logger, socket)

			expect(socket.writtenData).toHaveLength(2)
			expect(socket.writtenData[0]).toContain('BEGIN')
			expect(socket.writtenData[0]).toContain('CompanionVersion="test-build-123"')
			expect(socket.writtenData[0]).toContain('ApiVersion="1.10.0"')
			expect(socket.writtenData[1]).toContain('CAPS')
			expect(socket.writtenData[1]).toContain('SUBSCRIPTIONS=')
		})

		test('CAPS reports SUBSCRIPTIONS=0 when disabled', () => {
			const { api, logger } = createService({ subscriptionsEnabled: false })
			const socket = new TestSocketWrapper()

			api.initSocket(logger, socket)

			expect(socket.writtenData[1]).toContain('SUBSCRIPTIONS=0')
		})

		test('CAPS reports SUBSCRIPTIONS=1 when enabled', () => {
			const { api, logger } = createService({ subscriptionsEnabled: true })
			const socket = new TestSocketWrapper()

			api.initSocket(logger, socket)

			expect(socket.writtenData[1]).toContain('SUBSCRIPTIONS=1')
		})

		test('returns processMessage and cleanupDevices', () => {
			const { api, logger } = createService()
			const socket = new TestSocketWrapper()

			const result = api.initSocket(logger, socket)

			expect(result.processMessage).toBeTypeOf('function')
			expect(result.cleanupDevices).toBeTypeOf('function')
		})
	})

	describe('message buffering', () => {
		test('handles messages split across multiple chunks', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('PIN')
			expect(socket.writtenData).toHaveLength(0)

			processMessage('G\n')
			expect(socket.writtenData).toHaveLength(1)
			expect(socket.lastMessage).toContain('PONG')
		})

		test('handles multiple messages in a single chunk', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('PING 1\nPING 2\n')
			expect(socket.writtenData).toHaveLength(2)
			expect(socket.writtenData[0]).toContain('PONG 1')
			expect(socket.writtenData[1]).toContain('PONG 2')
		})

		test('strips carriage returns from messages', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('PING test\r\n')
			expect(socket.writtenData).toHaveLength(1)
			expect(socket.lastMessage).toContain('PONG test')
		})
	})

	describe('PING', () => {
		test('responds with PONG and body', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('PING 12345\n')

			expect(socket.writtenData).toHaveLength(1)
			expect(socket.lastMessage).toContain('PONG 12345')
		})
	})

	describe('QUIT', () => {
		test('destroys the socket', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('QUIT\n')

			expect(socket.destroyed).toBe(true)
		})
	})

	describe('unknown command', () => {
		test('sends error for unknown command', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('FOOBAR\n')

			expect(socket.writtenData).toHaveLength(1)
			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Unknown command: FOOBAR')
		})
	})

	describe('ADD-DEVICE', () => {
		test('error when missing DEVICEID', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('ADD-DEVICE PRODUCT_NAME="Test"\n')

			expect(socket.lastMessage).toContain('ADD-DEVICE')
			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Missing DEVICEID')
		})

		test('error when missing PRODUCT_NAME', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('ADD-DEVICE DEVICEID="dev1"\n')

			expect(socket.lastMessage).toContain('ADD-DEVICE')
			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Missing PRODUCT_NAME')
		})

		test('error for reserved emulator: prefix', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('ADD-DEVICE DEVICEID="emulator:1" PRODUCT_NAME="Test"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Reserved DEVICEID')
		})

		test('error for reserved group: prefix', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('ADD-DEVICE DEVICEID="group:1" PRODUCT_NAME="Test"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Reserved DEVICEID')
		})

		test('error when device already added on same socket', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test"\n')
			socket.clearMessages()

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Device already added')
		})

		test('error when device exists on different socket', () => {
			const { api, logger, surfaceController } = createService()
			const { socket: socket1, processMessage: processMessage1 } = createSocketAndInit(api, logger)
			const { socket: socket2, processMessage: processMessage2 } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			processMessage1('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test"\n')
			socket1.clearMessages()

			processMessage2('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test"\n')

			// Error is sent to the EXISTING socket (socket1), not the new one
			expect(socket1.lastMessage).toContain('ERROR')
			expect(socket1.lastMessage).toContain('Device exists elsewhere')
			// The requesting socket (socket2) receives no response — intentional protocol behaviour
			expect(socket2.lastMessage).toBeUndefined()
		})

		test('successfully adds device with defaults', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="TestProduct"\n')

			expect(surfaceController.addSatelliteDevice).toHaveBeenCalledTimes(1)

			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			expect(callArgs.deviceId).toBe('dev1')
			expect(callArgs.productName).toBe('TestProduct')
			expect(callArgs.supportsBrightness).toBe(true) // default when BRIGHTNESS not specified
			expect(callArgs.supportsLockedState).toBe(false) // default when PINCODE_LOCK not specified
			expect(callArgs.transferVariables).toEqual([]) // default when VARIABLES not specified
			expect(callArgs.gridSize).toEqual({ columns: 8, rows: 4 }) // LEGACY_MAX_BUTTONS=32 / LEGACY_BUTTONS_PER_ROW=8
			expect(callArgs.surfaceManifestFromClient).toBe(false)

			expect(socket.lastMessage).toContain('ADD-DEVICE')
			expect(socket.lastMessage).toContain('OK')
			expect(socket.lastMessage).toContain('DEVICEID="dev1"')
		})

		test('adds device with custom KEYS_TOTAL and KEYS_PER_ROW', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" KEYS_TOTAL=15 KEYS_PER_ROW=5\n')

			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			expect(callArgs.gridSize).toEqual({ columns: 5, rows: 3 })
		})

		test('error for KEYS_PER_ROW of 0', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" KEYS_PER_ROW=0\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Invalid KEYS_PER_ROW')
		})

		test('error for negative KEYS_TOTAL', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" KEYS_TOTAL=-1\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Invalid KEYS_TOTAL')
		})

		test('error for invalid KEYS_TOTAL', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" KEYS_TOTAL=abc\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Invalid KEYS_TOTAL')
		})

		test('error for KEYS_TOTAL of 0', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" KEYS_TOTAL=0\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Invalid KEYS_TOTAL')
		})

		test('error for invalid KEYS_PER_ROW', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" KEYS_PER_ROW=abc\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Invalid KEYS_PER_ROW')
		})

		test('adds device with BITMAPS enabled and custom size', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" BITMAPS=96\n')

			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			expect(callArgs.surfaceManifest.stylePresets.default.bitmap).toEqual({ w: 96, h: 96 })
		})

		test('BITMAPS defaults to 72 when truthy but not a valid number', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" BITMAPS=1\n')

			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			// 1 < 5, so fallback to 72
			expect(callArgs.surfaceManifest.stylePresets.default.bitmap).toEqual({ w: 72, h: 72 })
		})

		test('BITMAPS=false produces no bitmap in manifest', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" BITMAPS=false\n')

			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			expect(callArgs.surfaceManifest.stylePresets.default.bitmap).toBeUndefined()
		})

		test('BITMAPS=0 produces no bitmap in manifest', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" BITMAPS=0\n')

			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			expect(callArgs.surfaceManifest.stylePresets.default.bitmap).toBeUndefined()
		})

		test('adds device with COLORS=hex', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" COLORS=hex\n')

			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			expect(callArgs.surfaceManifest.stylePresets.default.colors).toBe('hex')
		})

		test('adds device with COLORS=rgb', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" COLORS=rgb\n')

			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			expect(callArgs.surfaceManifest.stylePresets.default.colors).toBe('rgb')
		})

		test('adds device with BRIGHTNESS=false', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" BRIGHTNESS=false\n')

			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			expect(callArgs.supportsBrightness).toBe(false)
		})

		test('adds device with PINCODE_LOCK=FULL', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" PINCODE_LOCK="FULL"\n')

			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			expect(callArgs.supportsLockedState).toBe(true)
		})

		test('adds device with PINCODE_LOCK=PARTIAL', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" PINCODE_LOCK="PARTIAL"\n')

			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			expect(callArgs.supportsLockedState).toBe(true)
		})

		test('adds device with TEXT and TEXT_STYLE enabled', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" TEXT=true TEXT_STYLE=true\n')

			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			expect(callArgs.surfaceManifest.stylePresets.default.text).toBe(true)
			expect(callArgs.surfaceManifest.stylePresets.default.textStyle).toBe(true)
		})

		test('adds device with LAYOUT_MANIFEST', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			const manifest = {
				controls: {
					btn1: { row: 0, column: 0 },
					btn2: { row: 0, column: 1 },
					btn3: { row: 1, column: 0 },
				},
				stylePresets: {
					default: {},
				},
			}
			const encoded = Buffer.from(JSON.stringify(manifest)).toString('base64')

			processMessage(`ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" LAYOUT_MANIFEST="${encoded}"\n`)

			expect(socket.lastMessage).toContain('ADD-DEVICE')
			expect(socket.lastMessage).toContain('OK')
			expect(surfaceController.addSatelliteDevice).toHaveBeenCalledTimes(1)
			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			expect(callArgs.surfaceManifestFromClient).toBe(true)
			expect(callArgs.gridSize).toEqual({ columns: 2, rows: 2 })
		})

		test('error for invalid LAYOUT_MANIFEST base64', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" LAYOUT_MANIFEST="not-valid-base64!!!"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Invalid LAYOUT_MANIFEST')
		})

		test('adds device with valid VARIABLES', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			const variables = [{ id: 'var1', type: 'input', name: 'Variable 1' }]
			const encoded = Buffer.from(JSON.stringify(variables)).toString('base64')

			processMessage(`ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" VARIABLES="${encoded}"\n`)

			expect(surfaceController.addSatelliteDevice).toHaveBeenCalledTimes(1)
			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			expect(callArgs.transferVariables).toEqual([
				{ id: 'var1', type: 'input', name: 'Variable 1', description: undefined },
			])
		})

		test('error for invalid VARIABLES', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const badVars = [{ id: 123, type: 'input', name: 'Bad' }] // id should be string
			const encoded = Buffer.from(JSON.stringify(badVars)).toString('base64')

			processMessage(`ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" VARIABLES="${encoded}"\n`)

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Invalid VARIABLES')
		})

		test('passes SERIAL to addSatelliteDevice', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" SERIAL="streamdeck:ABC123"\n')

			expect(surfaceController.addSatelliteDevice).toHaveBeenCalledTimes(1)
			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			expect(callArgs.serial).toBe('streamdeck:ABC123')
			expect(callArgs.serialIsUnique).toBe(true)
		})

		test('passes SERIAL_IS_UNIQUE=false to addSatelliteDevice', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" SERIAL="shared-id" SERIAL_IS_UNIQUE=false\n')

			expect(surfaceController.addSatelliteDevice).toHaveBeenCalledTimes(1)
			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			expect(callArgs.serial).toBe('shared-id')
			expect(callArgs.serialIsUnique).toBe(false)
		})

		test('passes SERIAL_IS_UNIQUE=true to addSatelliteDevice', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			processMessage(
				'ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" SERIAL="streamdeck:ABC123" SERIAL_IS_UNIQUE=true\n'
			)

			expect(surfaceController.addSatelliteDevice).toHaveBeenCalledTimes(1)
			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			expect(callArgs.serial).toBe('streamdeck:ABC123')
			expect(callArgs.serialIsUnique).toBe(true)
		})

		test('serial defaults to deviceId and serialIsUnique defaults to true when not provided', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test"\n')

			expect(surfaceController.addSatelliteDevice).toHaveBeenCalledTimes(1)
			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			expect(callArgs.serial).toBe('dev1')
			expect(callArgs.serialIsUnique).toBe(true)
		})

		test('adds device with valid CONFIG_FIELDS', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			const configFields = [{ id: 'cfg1', type: 'textinput', label: 'My Config Field' }]
			const encoded = Buffer.from(JSON.stringify(configFields)).toString('base64')

			processMessage(`ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" CONFIG_FIELDS="${encoded}"\n`)

			expect(socket.lastMessage).toContain('ADD-DEVICE')
			expect(socket.lastMessage).toContain('OK')
			expect(surfaceController.addSatelliteDevice).toHaveBeenCalledTimes(1)
			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			expect(callArgs.configFields).toMatchObject([
				{ id: 'plugin_cfg_cfg1', type: 'textinput', label: 'My Config Field' },
			])
		})

		test('error for invalid CONFIG_FIELDS JSON', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const encoded = Buffer.from('not valid json').toString('base64')

			processMessage(`ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" CONFIG_FIELDS="${encoded}"\n`)

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Invalid CONFIG_FIELDS')
		})

		test('error for CONFIG_FIELDS that fails schema validation', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			// Missing required 'id' and 'label'
			const badFields = [{ type: 'textinput' }]
			const encoded = Buffer.from(JSON.stringify(badFields)).toString('base64')

			processMessage(`ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test" CONFIG_FIELDS="${encoded}"\n`)

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Invalid CONFIG_FIELDS')
		})

		test('configFields is undefined when CONFIG_FIELDS not provided', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = mockDeep<SurfaceIPSatellite>(mockOptions)
			surfaceController.addSatelliteDevice.mockReturnValueOnce(mockDevice)

			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test"\n')

			const callArgs = surfaceController.addSatelliteDevice.mock.calls[0][0]
			expect(callArgs.configFields).toBeUndefined()
		})
	})

	describe('REMOVE-DEVICE', () => {
		test('error when missing DEVICEID', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('REMOVE-DEVICE\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Missing DEVICEID')
		})

		test('error when device not found', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('REMOVE-DEVICE DEVICEID="nonexist"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Device not found')
		})

		test('successfully removes device', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')
			surfaceController.removeDevice.mockReturnValue(undefined)

			processMessage('REMOVE-DEVICE DEVICEID="dev1"\n')

			expect(surfaceController.removeDevice).toHaveBeenCalledWith('dev1', { physicallyGone: true })
			expect(socket.lastMessage).toContain('REMOVE-DEVICE')
			expect(socket.lastMessage).toContain('OK')
			expect(socket.lastMessage).toContain('DEVICEID="dev1"')
		})

		test('device cannot be used after removal', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')
			surfaceController.removeDevice.mockReturnValue(undefined)

			processMessage('REMOVE-DEVICE DEVICEID="dev1"\n')
			socket.clearMessages()

			processMessage('KEY-PRESS DEVICEID="dev1" KEY=0 PRESSED=1\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Device not found')
		})
	})

	describe('KEY-PRESS', () => {
		test('error when missing DEVICEID', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('KEY-PRESS KEY=0 PRESSED=1\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Missing DEVICEID')
		})

		test('error when device not found', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('KEY-PRESS DEVICEID="nonexist" KEY=0 PRESSED=1\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Device not found')
		})

		describe('legacy mode (no manifest from client)', () => {
			test('error when missing KEY', () => {
				const { api, logger, surfaceController } = createService()
				const { socket, processMessage } = createSocketAndInit(api, logger)

				addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')

				processMessage('KEY-PRESS DEVICEID="dev1" PRESSED=1\n')

				expect(socket.lastMessage).toContain('ERROR')
				expect(socket.lastMessage).toContain('Missing KEY')
			})

			test('error when KEY is invalid', () => {
				const { api, logger, surfaceController } = createService()
				const { socket, processMessage } = createSocketAndInit(api, logger)

				const mockDevice = addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')
				mockDevice.parseKeyParam.mockReturnValue(null)

				processMessage('KEY-PRESS DEVICEID="dev1" KEY=999 PRESSED=1\n')

				expect(socket.lastMessage).toContain('ERROR')
				expect(socket.lastMessage).toContain('Invalid KEY')
			})

			test('error when missing PRESSED', () => {
				const { api, logger, surfaceController } = createService()
				const { socket, processMessage } = createSocketAndInit(api, logger)

				const mockDevice = addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')
				mockDevice.parseKeyParam.mockReturnValue([0, 0])

				processMessage('KEY-PRESS DEVICEID="dev1" KEY=0\n')

				expect(socket.lastMessage).toContain('ERROR')
				expect(socket.lastMessage).toContain('Missing PRESSED')
			})

			test('successfully presses key', () => {
				const { api, logger, surfaceController } = createService()
				const { socket, processMessage } = createSocketAndInit(api, logger)

				const mockDevice = addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')
				mockDevice.parseKeyParam.mockReturnValue([2, 3])
				mockDevice.doButton.mockReturnValue(undefined)

				processMessage('KEY-PRESS DEVICEID="dev1" KEY=5 PRESSED=1\n')

				expect(mockDevice.doButton).toHaveBeenCalledWith(2, 3, true)
				expect(socket.lastMessage).toContain('KEY-PRESS')
				expect(socket.lastMessage).toContain('OK')
			})

			test('successfully releases key', () => {
				const { api, logger, surfaceController } = createService()
				const { socket, processMessage } = createSocketAndInit(api, logger)

				const mockDevice = addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')
				mockDevice.parseKeyParam.mockReturnValue([1, 1])
				mockDevice.doButton.mockReturnValue(undefined)

				processMessage('KEY-PRESS DEVICEID="dev1" KEY=3 PRESSED=0\n')

				expect(mockDevice.doButton).toHaveBeenCalledWith(1, 1, false)
				expect(socket.lastMessage).toContain('KEY-PRESS')
				expect(socket.lastMessage).toContain('OK')
				expect(socket.lastMessage).toContain('DEVICEID="dev1"')
			})
		})

		describe('manifest mode (manifest from client)', () => {
			test('error when missing CONTROLID', () => {
				const { api, logger, surfaceController } = createService()
				const { socket, processMessage } = createSocketAndInit(api, logger)

				addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1', {
					surfaceManifestFromClient: true,
				})

				processMessage('KEY-PRESS DEVICEID="dev1" PRESSED=1\n')

				expect(socket.lastMessage).toContain('ERROR')
				expect(socket.lastMessage).toContain('Missing CONTROLID')
			})

			test('error when missing PRESSED', () => {
				const { api, logger, surfaceController } = createService()
				const { socket, processMessage } = createSocketAndInit(api, logger)

				addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1', {
					surfaceManifestFromClient: true,
				})

				processMessage('KEY-PRESS DEVICEID="dev1" CONTROLID="btn1"\n')

				expect(socket.lastMessage).toContain('ERROR')
				expect(socket.lastMessage).toContain('Missing PRESSED')
			})

			test('error when CONTROLID unknown', () => {
				const { api, logger, surfaceController } = createService()
				const { socket, processMessage } = createSocketAndInit(api, logger)

				const mockDevice = addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1', {
					surfaceManifestFromClient: true,
				})
				mockDevice.doButtonFromId.mockReturnValue(false)

				processMessage('KEY-PRESS DEVICEID="dev1" CONTROLID="unknown" PRESSED=1\n')

				expect(socket.lastMessage).toContain('ERROR')
				expect(socket.lastMessage).toContain('Unknown CONTROLID')
			})

			test('successfully presses button by CONTROLID', () => {
				const { api, logger, surfaceController } = createService()
				const { socket, processMessage } = createSocketAndInit(api, logger)

				const mockDevice = addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1', {
					surfaceManifestFromClient: true,
				})
				mockDevice.doButtonFromId.mockReturnValue(true)

				processMessage('KEY-PRESS DEVICEID="dev1" CONTROLID="btn1" PRESSED=1\n')

				expect(mockDevice.doButtonFromId).toHaveBeenCalledWith('btn1', true)
				expect(socket.lastMessage).toContain('KEY-PRESS')
				expect(socket.lastMessage).toContain('OK')
				expect(socket.lastMessage).toContain('DEVICEID="dev1"')
			})
		})
	})

	describe('KEY-ROTATE', () => {
		describe('legacy mode', () => {
			test('error when missing KEY', () => {
				const { api, logger, surfaceController } = createService()
				const { socket, processMessage } = createSocketAndInit(api, logger)

				addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')

				processMessage('KEY-ROTATE DEVICEID="dev1" DIRECTION=1\n')

				expect(socket.lastMessage).toContain('ERROR')
				expect(socket.lastMessage).toContain('Missing KEY')
			})

			test('error when KEY is invalid', () => {
				const { api, logger, surfaceController } = createService()
				const { socket, processMessage } = createSocketAndInit(api, logger)

				const mockDevice = addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')
				mockDevice.parseKeyParam.mockReturnValue(null)

				processMessage('KEY-ROTATE DEVICEID="dev1" KEY=999 DIRECTION=1\n')

				expect(socket.lastMessage).toContain('ERROR')
				expect(socket.lastMessage).toContain('Invalid KEY')
			})

			test('error when missing DIRECTION', () => {
				const { api, logger, surfaceController } = createService()
				const { socket, processMessage } = createSocketAndInit(api, logger)

				const mockDevice = addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')
				mockDevice.parseKeyParam.mockReturnValue([0, 0])

				processMessage('KEY-ROTATE DEVICEID="dev1" KEY=0\n')

				expect(socket.lastMessage).toContain('ERROR')
				expect(socket.lastMessage).toContain('Missing DIRECTION')
			})

			test('successfully rotates clockwise', () => {
				const { api, logger, surfaceController } = createService()
				const { socket, processMessage } = createSocketAndInit(api, logger)

				const mockDevice = addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')
				mockDevice.parseKeyParam.mockReturnValue([1, 2])
				mockDevice.doRotate.mockReturnValue(undefined)

				processMessage('KEY-ROTATE DEVICEID="dev1" KEY=3 DIRECTION=1\n')

				expect(mockDevice.doRotate).toHaveBeenCalledWith(1, 2, true)
				expect(socket.lastMessage).toContain('KEY-ROTATE')
				expect(socket.lastMessage).toContain('OK')
				expect(socket.lastMessage).toContain('DEVICEID="dev1"')
			})

			test('successfully rotates counter-clockwise', () => {
				const { api, logger, surfaceController } = createService()
				const { socket, processMessage } = createSocketAndInit(api, logger)

				const mockDevice = addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')
				mockDevice.parseKeyParam.mockReturnValue([0, 0])
				mockDevice.doRotate.mockReturnValue(undefined)

				processMessage('KEY-ROTATE DEVICEID="dev1" KEY=0 DIRECTION=0\n')

				expect(mockDevice.doRotate).toHaveBeenCalledWith(0, 0, false)
				expect(socket.lastMessage).toContain('KEY-ROTATE')
				expect(socket.lastMessage).toContain('OK')
				expect(socket.lastMessage).toContain('DEVICEID="dev1"')
			})
		})

		describe('manifest mode', () => {
			test('error when missing CONTROLID', () => {
				const { api, logger, surfaceController } = createService()
				const { socket, processMessage } = createSocketAndInit(api, logger)

				addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1', {
					surfaceManifestFromClient: true,
				})

				processMessage('KEY-ROTATE DEVICEID="dev1" DIRECTION=1\n')

				expect(socket.lastMessage).toContain('ERROR')
				expect(socket.lastMessage).toContain('Missing CONTROLID')
			})

			test('error when missing DIRECTION', () => {
				const { api, logger, surfaceController } = createService()
				const { socket, processMessage } = createSocketAndInit(api, logger)

				addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1', {
					surfaceManifestFromClient: true,
				})

				processMessage('KEY-ROTATE DEVICEID="dev1" CONTROLID="knob1"\n')

				expect(socket.lastMessage).toContain('ERROR')
				expect(socket.lastMessage).toContain('Missing DIRECTION')
			})

			test('error when CONTROLID unknown', () => {
				const { api, logger, surfaceController } = createService()
				const { socket, processMessage } = createSocketAndInit(api, logger)

				const mockDevice = addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1', {
					surfaceManifestFromClient: true,
				})
				mockDevice.doRotateFromId.mockReturnValue(false)

				processMessage('KEY-ROTATE DEVICEID="dev1" CONTROLID="unknown" DIRECTION=1\n')

				expect(socket.lastMessage).toContain('ERROR')
				expect(socket.lastMessage).toContain('Unknown CONTROLID')
			})

			test('successfully rotates by CONTROLID', () => {
				const { api, logger, surfaceController } = createService()
				const { socket, processMessage } = createSocketAndInit(api, logger)

				const mockDevice = addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1', {
					surfaceManifestFromClient: true,
				})
				mockDevice.doRotateFromId.mockReturnValue(true)

				processMessage('KEY-ROTATE DEVICEID="dev1" CONTROLID="knob1" DIRECTION=1\n')

				expect(mockDevice.doRotateFromId).toHaveBeenCalledWith('knob1', true)
				expect(socket.lastMessage).toContain('KEY-ROTATE')
				expect(socket.lastMessage).toContain('OK')
				expect(socket.lastMessage).toContain('DEVICEID="dev1"')
			})
		})
	})

	describe('PINCODE-KEY', () => {
		test('error when missing KEY', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')

			processMessage('PINCODE-KEY DEVICEID="dev1"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Missing KEY')
		})

		test('error when KEY is not a number', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')

			processMessage('PINCODE-KEY DEVICEID="dev1" KEY=abc\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Invalid KEY')
		})

		test('error when KEY is out of range (> 9)', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')

			processMessage('PINCODE-KEY DEVICEID="dev1" KEY=10\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Invalid KEY')
		})

		test('error when KEY is negative', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')

			processMessage('PINCODE-KEY DEVICEID="dev1" KEY=-1\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Invalid KEY')
		})

		test('successfully sends pincode key 0', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')
			mockDevice.doPincodeKey.mockReturnValue(undefined)

			processMessage('PINCODE-KEY DEVICEID="dev1" KEY=0\n')

			expect(mockDevice.doPincodeKey).toHaveBeenCalledWith(0)
			expect(socket.lastMessage).toContain('PINCODE-KEY')
			expect(socket.lastMessage).toContain('OK')
			expect(socket.lastMessage).toContain('DEVICEID="dev1"')
		})

		test('successfully sends pincode key 9', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')
			mockDevice.doPincodeKey.mockReturnValue(undefined)

			processMessage('PINCODE-KEY DEVICEID="dev1" KEY=9\n')

			expect(mockDevice.doPincodeKey).toHaveBeenCalledWith(9)
			expect(socket.lastMessage).toContain('PINCODE-KEY')
			expect(socket.lastMessage).toContain('OK')
			expect(socket.lastMessage).toContain('DEVICEID="dev1"')
		})
	})

	describe('SET-VARIABLE-VALUE', () => {
		test('error when missing VARIABLE', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')

			const encoded = Buffer.from('hello').toString('base64')
			processMessage(`SET-VARIABLE-VALUE DEVICEID="dev1" VALUE="${encoded}"\n`)

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Missing VARIABLE')
		})

		test('error when missing VALUE', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')

			processMessage('SET-VARIABLE-VALUE DEVICEID="dev1" VARIABLE="myvar"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Missing VALUE')
		})

		test('successfully sets variable value', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')
			mockDevice.setVariableValue.mockReturnValue(undefined)

			const value = 'hello world'
			const encoded = Buffer.from(value).toString('base64')

			processMessage(`SET-VARIABLE-VALUE DEVICEID="dev1" VARIABLE="myvar" VALUE="${encoded}"\n`)

			expect(mockDevice.setVariableValue).toHaveBeenCalledWith('myvar', 'hello world')
			expect(socket.lastMessage).toContain('OK')
			expect(socket.lastMessage).toContain('VARIABLE="myvar"')
		})
	})

	describe('FIRMWARE-UPDATE-INFO', () => {
		test('error when device not found', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('FIRMWARE-UPDATE-INFO DEVICEID="nonexist" UPDATE_URL="https://example.com/fw"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Device not found')
		})

		test('error when missing UPDATE_URL', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')

			processMessage('FIRMWARE-UPDATE-INFO DEVICEID="dev1"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Missing UPDATE_URL')
		})

		test('successfully reports firmware update URL', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')
			mockDevice.updateFirmwareUpdateInfo.mockReturnValue(undefined)

			processMessage('FIRMWARE-UPDATE-INFO DEVICEID="dev1" UPDATE_URL="https://example.com/fw.bin"\n')

			expect(mockDevice.updateFirmwareUpdateInfo).toHaveBeenCalledWith('https://example.com/fw.bin')
			expect(socket.lastMessage).toContain('FIRMWARE-UPDATE-INFO')
			expect(socket.lastMessage).toContain('OK')
			expect(socket.lastMessage).toContain('DEVICEID="dev1"')
		})

		test('empty UPDATE_URL clears firmware update (calls with null)', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockDevice = addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')
			mockDevice.updateFirmwareUpdateInfo.mockReturnValue(undefined)

			processMessage('FIRMWARE-UPDATE-INFO DEVICEID="dev1" UPDATE_URL=""\n')

			expect(mockDevice.updateFirmwareUpdateInfo).toHaveBeenCalledWith(null)
			expect(socket.lastMessage).toContain('OK')
		})
	})

	describe('ADD-SUB', () => {
		test('error when subscriptions not enabled', () => {
			const { api, logger } = createService({ subscriptionsEnabled: false })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('ADD-SUB SUBID="sub1" LOCATION="1/2/3"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Subscriptions not enabled')
		})

		test('error when missing SUBID', () => {
			const { api, logger } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('ADD-SUB LOCATION="1/2/3"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Missing SUBID')
		})

		test('error when SUBID contains invalid characters', () => {
			const { api, logger } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('ADD-SUB SUBID="bad chars!" LOCATION="1/2/3"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Invalid SUBID')
		})

		test('error when missing LOCATION', () => {
			const { api, logger } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('ADD-SUB SUBID="sub1"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Missing LOCATION')
		})

		test('error when LOCATION is invalid format', () => {
			const { api, logger } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('ADD-SUB SUBID="sub1" LOCATION="invalid"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Invalid LOCATION')
		})

		test('error when LOCATION has only two parts', () => {
			const { api, logger } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('ADD-SUB SUBID="sub1" LOCATION="1/2"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Invalid LOCATION')
		})

		test('error when SUBID already in use', () => {
			const { api, logger, serviceApi } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockRender = mock<ImageResult>()
			serviceApi.getCachedRenderOrGeneratePlaceholder.mockReturnValue(mockRender)

			processMessage('ADD-SUB SUBID="sub1" LOCATION="1/2/3"\n')
			socket.clearMessages()

			processMessage('ADD-SUB SUBID="sub1" LOCATION="4/5/6"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('SUBID already in use')
		})

		test('error for invalid STYLE', () => {
			const { api, logger } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const badStyle = Buffer.from('not valid json').toString('base64')

			processMessage(`ADD-SUB SUBID="sub1" LOCATION="1/2/3" STYLE="${badStyle}"\n`)

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Invalid STYLE')
		})

		test('successfully adds subscription', () => {
			const { api, logger, serviceApi } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockRender = mock<ImageResult>()
			serviceApi.getCachedRenderOrGeneratePlaceholder.mockReturnValue(mockRender)

			processMessage('ADD-SUB SUBID="sub1" LOCATION="1/2/3"\n')

			expect(socket.lastMessage).toContain('ADD-SUB')
			expect(socket.lastMessage).toContain('OK')
			expect(socket.lastMessage).toContain('SUBID="sub1"')

			expect(serviceApi.getCachedRenderOrGeneratePlaceholder).toHaveBeenCalledWith({
				pageNumber: 1,
				row: 2,
				column: 3,
			})
		})

		test('successfully adds subscription with BITMAP', () => {
			const { api, logger, serviceApi } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockRender = mock<ImageResult>()
			serviceApi.getCachedRenderOrGeneratePlaceholder.mockReturnValue(mockRender)

			processMessage('ADD-SUB SUBID="sub1" LOCATION="1/2/3" BITMAP=128\n')

			expect(socket.lastMessage).toContain('ADD-SUB')
			expect(socket.lastMessage).toContain('OK')
			expect(socket.lastMessage).toContain('SUBID="sub1"')
		})

		test('successfully adds subscription with base64 STYLE', () => {
			const { api, logger, serviceApi } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockRender = mock<ImageResult>()
			serviceApi.getCachedRenderOrGeneratePlaceholder.mockReturnValue(mockRender)

			const style = { bitmap: { w: 64, h: 64 }, text: true }
			const encoded = Buffer.from(JSON.stringify(style)).toString('base64')

			processMessage(`ADD-SUB SUBID="sub1" LOCATION="1/2/3" STYLE="${encoded}"\n`)

			expect(socket.lastMessage).toContain('ADD-SUB')
			expect(socket.lastMessage).toContain('OK')
			expect(socket.lastMessage).toContain('SUBID="sub1"')
		})
	})

	describe('REMOVE-SUB', () => {
		test('error when subscriptions not enabled', () => {
			const { api, logger } = createService({ subscriptionsEnabled: false })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('REMOVE-SUB SUBID="sub1"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Subscriptions not enabled')
		})

		test('error when missing SUBID', () => {
			const { api, logger } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('REMOVE-SUB\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Missing SUBID')
		})

		test('error when SUBID unknown', () => {
			const { api, logger } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('REMOVE-SUB SUBID="nonexist"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Unknown SUBID')
		})

		test('successfully removes subscription', () => {
			const { api, logger, serviceApi } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockRender = mock<ImageResult>()
			serviceApi.getCachedRenderOrGeneratePlaceholder.mockReturnValue(mockRender)

			processMessage('ADD-SUB SUBID="sub1" LOCATION="1/2/3"\n')
			socket.clearMessages()

			processMessage('REMOVE-SUB SUBID="sub1"\n')

			expect(socket.lastMessage).toContain('REMOVE-SUB')
			expect(socket.lastMessage).toContain('OK')
			expect(socket.lastMessage).toContain('SUBID="sub1"')
		})

		test('after removal, SUBID is unknown', () => {
			const { api, logger, serviceApi } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockRender = mock<ImageResult>()
			serviceApi.getCachedRenderOrGeneratePlaceholder.mockReturnValue(mockRender)

			processMessage('ADD-SUB SUBID="sub1" LOCATION="1/2/3"\n')
			processMessage('REMOVE-SUB SUBID="sub1"\n')
			socket.clearMessages()

			processMessage('REMOVE-SUB SUBID="sub1"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Unknown SUBID')
		})
	})

	describe('SUB-PRESS', () => {
		test('error when subscriptions not enabled', () => {
			const { api, logger } = createService({ subscriptionsEnabled: false })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('SUB-PRESS SUBID="sub1" PRESSED=1\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Subscriptions not enabled')
		})

		test('error when missing SUBID', () => {
			const { api, logger } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('SUB-PRESS PRESSED=1\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Missing SUBID')
		})

		test('error when SUBID unknown', () => {
			const { api, logger } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('SUB-PRESS SUBID="nonexist" PRESSED=1\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Unknown SUBID')
		})

		test('error when missing PRESSED', () => {
			const { api, logger, serviceApi } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockRender = mock<ImageResult>()
			serviceApi.getCachedRenderOrGeneratePlaceholder.mockReturnValue(mockRender)

			processMessage('ADD-SUB SUBID="sub1" LOCATION="1/2/3"\n')
			socket.clearMessages()

			processMessage('SUB-PRESS SUBID="sub1"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Missing PRESSED')
		})

		test('successfully presses subscribed control', () => {
			const { api, logger, serviceApi } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockRender = mock<ImageResult>()
			serviceApi.getCachedRenderOrGeneratePlaceholder.mockReturnValue(mockRender)
			serviceApi.getControlIdAt.mockReturnValue('ctrl-abc')
			serviceApi.pressControl.mockReturnValue(true)

			processMessage('ADD-SUB SUBID="sub1" LOCATION="1/2/3"\n')
			socket.clearMessages()

			processMessage('SUB-PRESS SUBID="sub1" PRESSED=1\n')

			expect(serviceApi.getControlIdAt).toHaveBeenCalledWith({
				pageNumber: 1,
				row: 2,
				column: 3,
			})
			expect(serviceApi.pressControl).toHaveBeenCalledWith('ctrl-abc', true, expect.stringContaining('satellite-sub:'))
			expect(socket.lastMessage).toContain('SUB-PRESS')
			expect(socket.lastMessage).toContain('OK')
			expect(socket.lastMessage).toContain('SUBID="sub1"')
		})

		test('still succeeds when no control at location', () => {
			const { api, logger, serviceApi } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockRender = mock<ImageResult>()
			serviceApi.getCachedRenderOrGeneratePlaceholder.mockReturnValue(mockRender)
			serviceApi.getControlIdAt.mockReturnValue(null)

			processMessage('ADD-SUB SUBID="sub1" LOCATION="1/2/3"\n')
			socket.clearMessages()

			processMessage('SUB-PRESS SUBID="sub1" PRESSED=1\n')

			expect(serviceApi.pressControl).not.toHaveBeenCalled()
			expect(socket.lastMessage).toContain('OK')
		})
	})

	describe('SUB-ROTATE', () => {
		test('error when subscriptions not enabled', () => {
			const { api, logger } = createService({ subscriptionsEnabled: false })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('SUB-ROTATE SUBID="sub1" DIRECTION=1\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Subscriptions not enabled')
		})

		test('error when missing SUBID', () => {
			const { api, logger } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('SUB-ROTATE DIRECTION=1\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Missing SUBID')
		})

		test('error when SUBID unknown', () => {
			const { api, logger } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('SUB-ROTATE SUBID="nonexist" DIRECTION=1\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Unknown SUBID')
		})

		test('error when missing DIRECTION', () => {
			const { api, logger, serviceApi } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockRender = mock<ImageResult>()
			serviceApi.getCachedRenderOrGeneratePlaceholder.mockReturnValue(mockRender)

			processMessage('ADD-SUB SUBID="sub1" LOCATION="1/2/3"\n')
			socket.clearMessages()

			processMessage('SUB-ROTATE SUBID="sub1"\n')

			expect(socket.lastMessage).toContain('ERROR')
			expect(socket.lastMessage).toContain('Missing DIRECTION')
		})

		test('successfully rotates subscribed control', () => {
			const { api, logger, serviceApi } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockRender = mock<ImageResult>()
			serviceApi.getCachedRenderOrGeneratePlaceholder.mockReturnValue(mockRender)
			serviceApi.getControlIdAt.mockReturnValue('ctrl-abc')
			serviceApi.rotateControl.mockReturnValue(true)

			processMessage('ADD-SUB SUBID="sub1" LOCATION="1/2/3"\n')
			socket.clearMessages()

			processMessage('SUB-ROTATE SUBID="sub1" DIRECTION=1\n')

			expect(serviceApi.rotateControl).toHaveBeenCalledWith('ctrl-abc', true, expect.stringContaining('satellite-sub:'))
			expect(socket.lastMessage).toContain('SUB-ROTATE')
			expect(socket.lastMessage).toContain('OK')
			expect(socket.lastMessage).toContain('SUBID="sub1"')
		})

		test('still succeeds when no control at location', () => {
			const { api, logger, serviceApi } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockRender = mock<ImageResult>()
			serviceApi.getCachedRenderOrGeneratePlaceholder.mockReturnValue(mockRender)
			serviceApi.getControlIdAt.mockReturnValue(null)

			processMessage('ADD-SUB SUBID="sub1" LOCATION="1/2/3"\n')
			socket.clearMessages()

			processMessage('SUB-ROTATE SUBID="sub1" DIRECTION=0\n')

			expect(serviceApi.rotateControl).not.toHaveBeenCalled()
			expect(socket.lastMessage).toContain('OK')
		})
	})

	describe('updateUserConfig', () => {
		test('destroys all sockets when satellite_subscriptions_enabled is toggled', () => {
			const { api, logger } = createService()
			const socket1 = new TestSocketWrapper()
			const socket2 = new TestSocketWrapper()
			api.initSocket(logger, socket1)
			api.initSocket(logger, socket2)

			api.updateUserConfig('satellite_subscriptions_enabled', true)

			expect(socket1.destroyed).toBe(true)
			expect(socket2.destroyed).toBe(true)
		})

		test('does not destroy sockets for unrelated config keys', () => {
			const { api, logger } = createService()
			const socket = new TestSocketWrapper()
			api.initSocket(logger, socket)

			api.updateUserConfig('some_other_key', true)

			expect(socket.destroyed).toBe(false)
		})
	})

	describe('cleanupDevices', () => {
		test('removes all devices for a socket', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage, cleanupDevices } = createSocketAndInit(api, logger)

			addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev1')
			addDeviceToSocket(api, logger, surfaceController, socket, processMessage, 'dev2')
			surfaceController.removeDevice.mockReturnValue(undefined)

			const count = cleanupDevices()

			expect(count).toBe(2)
			expect(surfaceController.removeDevice).toHaveBeenCalledWith('dev1', { physicallyGone: true })
			expect(surfaceController.removeDevice).toHaveBeenCalledWith('dev2', { physicallyGone: true })
		})

		test('returns 0 when no devices', () => {
			const { api, logger } = createService()
			const { cleanupDevices } = createSocketAndInit(api, logger)

			const count = cleanupDevices()

			expect(count).toBe(0)
		})

		test('does not remove devices from other sockets', () => {
			const { api, logger, surfaceController } = createService()
			const { socket: socket1, processMessage: pm1, cleanupDevices: cleanup1 } = createSocketAndInit(api, logger)
			const { socket: socket2, processMessage: pm2 } = createSocketAndInit(api, logger)

			addDeviceToSocket(api, logger, surfaceController, socket1, pm1, 'dev1')
			addDeviceToSocket(api, logger, surfaceController, socket2, pm2, 'dev2')
			surfaceController.removeDevice.mockReturnValue(undefined)

			const count = cleanup1()

			expect(count).toBe(1)
			expect(surfaceController.removeDevice).toHaveBeenCalledWith('dev1', { physicallyGone: true })
			expect(surfaceController.removeDevice).not.toHaveBeenCalledWith('dev2', { physicallyGone: true })
		})

		test('cleans up subscriptions for the socket', async () => {
			const { api, logger, serviceApi } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage, cleanupDevices } = createSocketAndInit(api, logger)

			const mockRender = mock<ImageResult>()
			serviceApi.getCachedRenderOrGeneratePlaceholder.mockReturnValue(mockRender)

			processMessage('ADD-SUB SUBID="sub1" LOCATION="1/2/3"\n')
			await expect.poll(() => socket.writtenData.some((m) => m.includes('SUB-STATE'))).toBe(true)

			cleanupDevices()
			socket.clearMessages()

			// After cleanup, onButtonDrawn at the previously subscribed location should produce no output
			api.onButtonDrawn({ pageNumber: 1, row: 2, column: 3 }, mockRender)
			await new Promise<void>((resolve) => setTimeout(resolve, 20))

			expect(socket.writtenData).toHaveLength(0)
		})
	})

	describe('onButtonDrawn', () => {
		test('routes render to matching subscriptions', async () => {
			const { api, logger, serviceApi } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockRender = mock<ImageResult>()
			serviceApi.getCachedRenderOrGeneratePlaceholder.mockReturnValue(mockRender)

			processMessage('ADD-SUB SUBID="sub1" LOCATION="1/2/3"\n')

			// Wait for the initial SUB-STATE from ADD-SUB to be delivered
			await expect.poll(() => socket.writtenData.some((m) => m.includes('SUB-STATE'))).toBe(true)
			socket.clearMessages()

			// Trigger a button draw at the matching location
			api.onButtonDrawn({ pageNumber: 1, row: 2, column: 3 }, mockRender)

			await expect
				.poll(() => socket.writtenData.some((m) => m.includes('SUB-STATE') && m.includes('SUBID="sub1"')))
				.toBe(true)
		})

		test('does not route to non-matching subscriptions', async () => {
			const { api, logger, serviceApi } = createService({ subscriptionsEnabled: true })
			const { socket, processMessage } = createSocketAndInit(api, logger)

			const mockRender = mock<ImageResult>()
			serviceApi.getCachedRenderOrGeneratePlaceholder.mockReturnValue(mockRender)

			processMessage('ADD-SUB SUBID="sub1" LOCATION="1/2/3"\n')

			// Wait for the initial SUB-STATE from ADD-SUB to settle, then record message count
			await expect.poll(() => socket.writtenData.some((m) => m.includes('SUB-STATE'))).toBe(true)
			const messageCount = socket.writtenData.length

			// Trigger at a non-matching location — the queue should not receive anything
			api.onButtonDrawn({ pageNumber: 99, row: 99, column: 99 }, mockRender)
			await new Promise<void>((resolve) => setTimeout(resolve, 20))

			expect(socket.writtenData).toHaveLength(messageCount)
		})
	})

	describe('SatelliteSocketWrapper', () => {
		test('sendMessage formats string messages correctly', () => {
			const socket = new TestSocketWrapper()

			socket.sendMessage('TEST', 'OK', 'dev1', { KEY: 'value', NUM: 42, BOOL: true })

			expect(socket.lastMessage).toBe('TEST OK DEVICEID="dev1" KEY="value" NUM=42 BOOL=1 \n')
		})

		test('sendMessage handles null status and deviceId', () => {
			const socket = new TestSocketWrapper()

			socket.sendMessage('PONG', null, null, {})

			expect(socket.lastMessage).toBe('PONG \n')
		})

		test('sendMessage formats boolean false as 0', () => {
			const socket = new TestSocketWrapper()

			socket.sendMessage('TEST', null, null, { FLAG: false })

			expect(socket.lastMessage).toBe('TEST FLAG=0 \n')
		})

		test('sendMessage with ERROR status', () => {
			const socket = new TestSocketWrapper()

			socket.sendMessage('CMD', 'ERROR', 'dev1', { MESSAGE: 'Something went wrong' })

			expect(socket.lastMessage).toBe('CMD ERROR DEVICEID="dev1" MESSAGE="Something went wrong" \n')
		})
	})

	describe('error handling in processMessage', () => {
		test('catches and logs errors from command handlers', () => {
			const { api, logger, surfaceController } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			// Make addSatelliteDevice throw
			surfaceController.addSatelliteDevice.mockImplementation(() => {
				throw new Error('unexpected error')
			})

			// This should not throw - errors should be caught
			processMessage('ADD-DEVICE DEVICEID="dev1" PRODUCT_NAME="Test"\n')

			expect(logger.error).toHaveBeenCalled()
			// No socket response is sent when an unhandled exception escapes a command handler
			expect(socket.lastMessage).toBeUndefined()
		})
	})

	describe('case insensitivity', () => {
		test('commands are case insensitive', () => {
			const { api, logger } = createService()
			const { socket, processMessage } = createSocketAndInit(api, logger)

			processMessage('ping test\n')

			expect(socket.lastMessage).toContain('PONG')
		})
	})
})
