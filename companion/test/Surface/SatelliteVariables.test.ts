import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { SatelliteVariableEncoding } from '@companion-app/satellite-protocol'
import type { VariableValue } from '@companion-app/shared/Model/Variables.js'
import { SurfaceIPSatellite, type SatelliteDeviceInfo } from '../../lib/Surface/IP/Satellite.js'

describe('SurfaceIPSatellite output variables', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	function makeSatellite(variableEncoding: SatelliteVariableEncoding, value: VariableValue) {
		const sendMessage = vi.fn()
		const deviceInfo: SatelliteDeviceInfo = {
			connectionId: 'conn1',
			deviceId: 'dev1',
			serial: 'serial1',
			serialIsUnique: true,
			productName: 'Test Deck',
			socket: { remoteAddress: '1.2.3.4', sendMessage } as any,
			gridSize: { columns: 2, rows: 2 },
			supportsBrightness: false,
			transferVariables: [{ id: 'out1', type: 'output', name: 'Output 1', description: undefined }],
			supportsLockedState: false,
			surfaceManifestFromClient: false,
			surfaceManifest: { stylePresets: { default: {} }, controls: {} },
			configFields: undefined,
			canChangePage: undefined,
			bitmapFormat: 'rgb',
			variableEncoding,
		}

		const executeExpression = vi.fn().mockReturnValue({ ok: true, value, variableIds: new Set() })
		new SurfaceIPSatellite(deviceInfo, 'satellite:dev1', executeExpression)

		// Let the debounced send run
		vi.advanceTimersByTime(50)

		const call = sendMessage.mock.calls.find((c) => c[0] === 'VARIABLE-VALUE')
		expect(call).toBeTruthy()
		return call![3] as Record<string, string>
	}

	test.each<[VariableValue, string]>([
		['hello', 'hello'],
		[42, '42'],
		[true, 'true'],
		[{ a: 1 }, '{"a":1}'],
	])('sends %j as a string by default', (value, expected) => {
		const args = makeSatellite('string', value)
		expect(args.VARIABLE).toBe('out1')
		expect(Buffer.from(args.VALUE, 'base64').toString()).toBe(expected)
		expect(args.ENCODING).toBeUndefined()
	})

	test.each<VariableValue>(['hello', 42, true, null, { a: [1, 'b'] }])('sends %j as json when opted in', (value) => {
		const args = makeSatellite('json', value)
		expect(args.VARIABLE).toBe('out1')
		expect(args.ENCODING).toBe('json')
		expect(JSON.parse(Buffer.from(args.VALUE, 'base64').toString())).toEqual(value)
	})
})
