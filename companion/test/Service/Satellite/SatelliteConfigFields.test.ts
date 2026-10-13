import { describe, expect, test } from 'vitest'
import type { ConfigField } from '@companion-app/satellite-protocol'
import { translateSatelliteConfigFields } from '../../../lib/Service/Satellite/SatelliteConfigFields.js'

describe('translateSatelliteConfigFields', () => {
	test('translates each field type', () => {
		const fields: ConfigField[] = [
			{ id: 'st', label: 'Static', type: 'static-text', value: 'Hello' },
			{ id: 'ti', label: 'Text', type: 'textinput', default: 'x', regex: '/^x$/' },
			{ id: 'cb', label: 'Check', type: 'checkbox' },
			{ id: 'num', label: 'Number', type: 'number', min: 2, max: 10, step: 2 },
			{
				id: 'dd',
				label: 'Dropdown',
				type: 'dropdown',
				choices: [
					{ id: 'a', label: 'A' },
					{ id: 'b', label: 'B' },
				],
				allowCustom: true,
			},
		]

		const result = translateSatelliteConfigFields(fields)

		expect(result.map((f) => [f.id, f.type])).toEqual([
			['st', 'static-text'],
			['ti', 'textinput'],
			['cb', 'checkbox'],
			['num', 'number'],
			['dd', 'dropdown'],
		])
		expect(result[0]).toMatchObject({ label: 'Static', value: 'Hello' })
		expect(result[1]).toMatchObject({ default: 'x', regex: '/^x$/', multiline: false })
		expect(result[2]).toMatchObject({ default: false })
		expect(result[3]).toMatchObject({ default: 2, min: 2, max: 10, step: 2 })
		expect(result[4]).toMatchObject({
			default: 'a',
			allowCustom: true,
			choices: [
				{ id: 'a', label: 'A' },
				{ id: 'b', label: 'B' },
			],
		})
	})

	test.each(['__proto__', 'constructor', 'prototype'])('drops a field with the id %s', (id) => {
		const result = translateSatelliteConfigFields([
			{ id, label: 'Bad', type: 'checkbox' },
			{ id: 'ok', label: 'Good', type: 'checkbox' },
		])
		expect(result.map((f) => f.id)).toEqual(['ok'])
	})
})
