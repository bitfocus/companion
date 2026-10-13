import { describe, expect, test } from 'vitest'
import { mock } from 'vitest-mock-extended'
import type { SatelliteSocketWrapper } from '../../../lib/Service/Satellite/SatelliteApi.js'
import {
	generateConfigFields,
	type SatelliteDeviceInfo,
	type SatelliteInputVariableInfo,
	type SatelliteOutputVariableInfo,
	type SatelliteTransferableValue,
} from '../../../lib/Surface/IP/Satellite.js'

function deviceInfo(overrides: Partial<SatelliteDeviceInfo>): SatelliteDeviceInfo {
	return {
		connectionId: 'conn',
		deviceId: 'dev',
		serial: 'dev',
		serialIsUnique: true,
		productName: 'Test',
		socket: mock<SatelliteSocketWrapper>(),
		gridSize: { rows: 1, columns: 1 },
		supportsBrightness: false,
		transferVariables: [],
		supportsLockedState: false,
		surfaceManifestFromClient: false,
		surfaceManifest: { stylePresets: { default: {} }, controls: {} },
		configFields: undefined,
		canChangePage: undefined,
		bitmapFormat: 'rgb',
		...overrides,
	}
}

function generate(info: SatelliteDeviceInfo) {
	const inputVariables: Record<string, SatelliteInputVariableInfo> = {}
	const outputVariables: Record<string, SatelliteOutputVariableInfo> = {}
	const fields = generateConfigFields(info, inputVariables, outputVariables)
	return { ids: fields.map((f) => f.id), fields, inputVariables, outputVariables }
}

describe('generateConfigFields', () => {
	test('adds a field per transfer variable, and records it', () => {
		const transferVariables: SatelliteTransferableValue[] = [
			{ id: 'in1', type: 'input', name: 'Input', description: 'an input' },
			{ id: 'out1', type: 'output', name: 'Output', description: undefined },
		]
		const { fields, inputVariables, outputVariables } = generate(deviceInfo({ transferVariables }))

		expect(fields.find((f) => f.id === 'satellite_input_in1')).toMatchObject({
			type: 'custom-variable',
			label: 'Input',
			tooltip: 'an input',
		})
		expect(fields.find((f) => f.id === 'satellite_output_out1')).toMatchObject({
			type: 'expression',
			label: 'Output',
			allowInvalidValues: true,
		})
		expect(inputVariables).toEqual({ in1: { id: 'satellite_input_in1', lastValue: '' } })
		expect(outputVariables).toEqual({
			out1: { id: 'satellite_output_out1', lastReferencedVariables: null, lastValue: undefined },
		})
	})

	test.each(['__proto__', 'constructor', 'prototype'])('skips a transfer variable with the id %s', (id) => {
		const { ids, inputVariables } = generate(
			deviceInfo({ transferVariables: [{ id, type: 'input', name: 'Bad', description: undefined }] })
		)
		expect(ids.filter((f) => f.startsWith('satellite_'))).toEqual([])
		expect(Object.keys(inputVariables)).toEqual([])
	})
})
