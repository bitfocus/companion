import fs from 'node:fs'
import { describe, expect, test } from 'vitest'
import { SatelliteConfigFieldsSchema } from '../SatelliteConfigFieldsSchema.js'
import { SatelliteSurfaceLayoutSchema } from '../SatelliteSurfaceManifestSchema.js'

function layout(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		stylePresets: { default: { bitmap: { w: 72, h: 72 } } },
		controls: { '0/0': { row: 0, column: 0 } },
		...overrides,
	}
}

describe('SatelliteSurfaceLayoutSchema', () => {
	test('requires the default style preset', () => {
		expect(SatelliteSurfaceLayoutSchema.safeParse(layout()).success).toBe(true)
		expect(SatelliteSurfaceLayoutSchema.safeParse(layout({ stylePresets: {} })).success).toBe(false)
	})

	test.each([
		['1/0', true],
		['knob-1', true],
		['', false],
		['a b', false],
		['a"b', false],
	])('control id %j valid=%s', (id, valid) => {
		expect(SatelliteSurfaceLayoutSchema.safeParse(layout({ controls: { [id]: { row: 0, column: 0 } } })).success).toBe(
			valid
		)
	})

	test('accepts unknown properties, so newer clients can talk to older Companion', () => {
		const result = SatelliteSurfaceLayoutSchema.safeParse(
			layout({
				futureTopLevel: 1,
				stylePresets: { default: { futureStyle: true } },
				controls: { a: { row: 0, column: 0, futureControl: 'x' } },
			})
		)
		expect(result.success).toBe(true)
	})
})

describe('SatelliteConfigFieldsSchema', () => {
	test('rejects an unknown field type', () => {
		expect(SatelliteConfigFieldsSchema.safeParse([{ id: 'f', label: 'F', type: 'checkbox' }]).success).toBe(true)
		expect(SatelliteConfigFieldsSchema.safeParse([{ id: 'f', label: 'F', type: 'colour' }]).success).toBe(false)
	})
})

describe('entry points', () => {
	// Clients that don't validate manifests (eg the Stream Deck plugin) import these to avoid bundling zod
	test.each(['codec', 'constants', 'versions'])('%s does not depend on zod', (name) => {
		const source = fs.readFileSync(new URL(`../${name}.ts`, import.meta.url), 'utf8')
		expect(source).not.toMatch(/from 'zod'/)
	})
})
