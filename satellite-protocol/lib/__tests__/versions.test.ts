import { describe, expect, test } from 'vitest'
import { API_VERSION } from '../constants.js'
import {
	compareApiVersions,
	getSatelliteFeatures,
	isApiVersionAtLeast,
	parseApiVersion,
	SATELLITE_FEATURES,
} from '../versions.js'

describe('parseApiVersion', () => {
	test('parses major.minor.patch', () => {
		expect(parseApiVersion('1.14.0')).toEqual([1, 14, 0])
	})

	test('ignores prerelease and build suffixes', () => {
		expect(parseApiVersion('1.2.3-beta.1')).toEqual([1, 2, 3])
		expect(parseApiVersion('1.2.3+abc')).toEqual([1, 2, 3])
	})

	test('rejects invalid versions', () => {
		expect(parseApiVersion('')).toBeNull()
		expect(parseApiVersion('1.2')).toBeNull()
		expect(parseApiVersion('v1.2.3')).toBeNull()
		expect(parseApiVersion('a.b.c')).toBeNull()
	})
})

describe('compareApiVersions', () => {
	test('compares numerically, not lexically', () => {
		expect(compareApiVersions('1.10.0', '1.9.0')).toBeGreaterThan(0)
		expect(compareApiVersions('1.9.0', '1.10.0')).toBeLessThan(0)
		expect(compareApiVersions('1.10.1', '1.10.0')).toBeGreaterThan(0)
		expect(compareApiVersions('2.0.0', '1.99.99')).toBeGreaterThan(0)
		expect(compareApiVersions('1.10.0', '1.10.0')).toBe(0)
	})

	test('sorts invalid versions first', () => {
		expect(compareApiVersions('bad', '0.0.0')).toBeLessThan(0)
		expect(compareApiVersions('0.0.0', 'bad')).toBeGreaterThan(0)
		expect(compareApiVersions('bad', 'worse')).toBe(0)
	})
})

describe('isApiVersionAtLeast', () => {
	test('checks against the minimum', () => {
		expect(isApiVersionAtLeast('1.10.0', '1.10.0')).toBe(true)
		expect(isApiVersionAtLeast('1.11.0', '1.10.0')).toBe(true)
		expect(isApiVersionAtLeast('1.9.9', '1.10.0')).toBe(false)
	})

	test('is false for an invalid version', () => {
		expect(isApiVersionAtLeast('', '0.0.0')).toBe(false)
	})
})

describe('SATELLITE_FEATURES', () => {
	test('every feature is introduced by a valid version no newer than API_VERSION', () => {
		for (const feature of Object.values(SATELLITE_FEATURES)) {
			expect(parseApiVersion(feature.since)).not.toBeNull()
			expect(compareApiVersions(feature.since, API_VERSION)).toBeLessThanOrEqual(0)
		}
	})

	test('caps flags are only used once CAPS exists', () => {
		for (const feature of Object.values(SATELLITE_FEATURES)) {
			if (feature.capsFlag) {
				expect(isApiVersionAtLeast(feature.since, SATELLITE_FEATURES.caps.since)).toBe(true)
			}
		}
	})
})

describe('getSatelliteFeatures', () => {
	test('nothing is available for an invalid version', () => {
		expect(Object.values(getSatelliteFeatures('', null)).some((v) => v)).toBe(false)
	})

	test('gates on the api version', () => {
		const features = getSatelliteFeatures('1.9.0', null)
		expect(features.lockState).toBe(true)
		expect(features.surfaceManifest).toBe(true)
		expect(features.deviceSerial).toBe(false)
		expect(features.caps).toBe(false)
	})

	test('features with a caps flag require it to be set', () => {
		const features = getSatelliteFeatures(API_VERSION, {
			SUBSCRIPTIONS: '0',
			NONSQUARE: '1',
			BITMAP_FORMATS: 'rgb,png,webp',
		})
		expect(features.subscriptions).toBe(false)
		expect(features.nonSquareBitmaps).toBe(true)
		expect(features.bitmapFormats).toBe(true)
		expect(features.rotaryAmount).toBe(false)
		expect(features.leds).toBe(true)
	})

	test('features with a caps flag are unavailable before CAPS is received', () => {
		const features = getSatelliteFeatures(API_VERSION, null)
		expect(features.subscriptions).toBe(false)
		expect(features.caps).toBe(true)
	})

	test('a caps flag is ignored when the api version predates the feature', () => {
		expect(getSatelliteFeatures('1.13.0', { ROTARY_AMOUNT: '1' }).rotaryAmount).toBe(false)
	})
})
