import { describe, expect, test } from 'vitest'
import { translateSatelliteConfigFields } from '../../../lib/Service/Satellite/SatelliteConfigFields.js'

describe('translateSatelliteConfigFields', () => {
	test.each(['__proto__', 'constructor', 'prototype'])('drops a field with the id %s', (id) => {
		const result = translateSatelliteConfigFields([
			{ id, label: 'Bad', type: 'checkbox' },
			{ id: 'ok', label: 'Good', type: 'checkbox' },
		])
		expect(result.map((f) => f.id)).toEqual(['ok'])
	})
})
