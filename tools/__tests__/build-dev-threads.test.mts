import { describe, expect, test } from 'vitest'
import { shouldBundleFromSource } from '../build_dev_threads.mts'

describe('shouldBundleFromSource', () => {
	test.each([
		'@companion-app/shared',
		'@companion-app/shared/Model/Common.js',
		'@companion-app/satellite-protocol',
		'@companion-app/satellite-protocol/codec',
	])('bundles the workspace import %s', (importPath) => {
		expect(shouldBundleFromSource(importPath)).toBe(true)
	})

	test.each(['zod', '@companion-app/expressions', '@companion-app/shared-other', '@companion-app/satellite-protocolx'])(
		'leaves %s external',
		(importPath) => {
			expect(shouldBundleFromSource(importPath)).toBe(false)
		}
	)
})
