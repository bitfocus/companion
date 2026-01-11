import {
	DiscoveredSurfaceRegistry,
	type DiscoveredSurfaceInfo,
	type SurfaceOpener,
} from '../../../lib/Instance/Surface/DiscoveredSurfaceRegistry.js'
import { describe, expect, test } from 'vitest'

const mockOpener: SurfaceOpener = {
	instanceId: 'test-instance',
	openDiscoveredSurface: async () => {},
}

function createSurface(surfaceId: string, surfaceIdIsNotUnique: boolean): DiscoveredSurfaceInfo {
	return {
		surfaceId,
		surfaceIdIsNotUnique,
		description: 'Test Surface',
	}
}

describe('DiscoveredSurfaceRegistry', () => {
	test('generates different IDs for different uniqueness keys', () => {
		const generator = new DiscoveredSurfaceRegistry()

		const id1 = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw0', mockOpener)
		const id2 = generator.trackSurface(createSurface('1234:9999', false), 'test-instance:/dev/hidraw1', mockOpener)

		expect(id1).not.toBe(id2)
		expect(id1).toBe('1234:5678')
		expect(id2).toBe('1234:9999')
	})

	test('generates different IDs for same uniqueness key with different paths', () => {
		const generator = new DiscoveredSurfaceRegistry()

		const id1 = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw0', mockOpener)
		const id2 = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw1', mockOpener)

		expect(id1).not.toBe(id2)
		expect(id1).toBe('1234:5678')
		expect(id2).toBe('1234:5678-dev2')
	})

	test('returns same ID for same device path on repeated calls', () => {
		const generator = new DiscoveredSurfaceRegistry()

		const id1 = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw0', mockOpener)
		const id2 = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw0', mockOpener)

		expect(id1).toBe(id2)
	})

	test('generates stable IDs with counter increment', () => {
		const generator = new DiscoveredSurfaceRegistry()

		const id1 = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw0', mockOpener)
		const id2 = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw1', mockOpener)
		const id3 = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw2', mockOpener)

		// All should be unique
		expect(new Set([id1, id2, id3]).size).toBe(3)
		expect(id1).toBe('1234:5678')
		expect(id2).toBe('1234:5678-dev2')
		expect(id3).toBe('1234:5678-dev3')
	})

	test('separate instances have independent state', () => {
		const generator1 = new DiscoveredSurfaceRegistry()
		const generator2 = new DiscoveredSurfaceRegistry()

		const id1 = generator1.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw0', mockOpener)
		const id2 = generator2.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw1', mockOpener)

		// Different instances generate independently
		expect(id1).toBe('1234:5678')
		expect(id2).toBe('1234:5678')
	})

	test('handles multiple devices with same uniqueness key in batch', () => {
		const generator = new DiscoveredSurfaceRegistry()

		// Simulate 3 identical devices (same vendor/product) with different paths
		const ids = [
			generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw0', mockOpener),
			generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw1', mockOpener),
			generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw2', mockOpener),
		]

		// All should be unique
		expect(new Set(ids).size).toBe(3)
		expect(ids[0]).toBe('1234:5678')
		expect(ids[1]).toBe('1234:5678-dev2')
		expect(ids[2]).toBe('1234:5678-dev3')

		// Requesting same path again should return cached ID
		expect(generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw1', mockOpener)).toBe(
			ids[1]
		)
	})

	test('alwaysAddSuffix parameter forces suffix even for first device', () => {
		const generator = new DiscoveredSurfaceRegistry()

		const id = generator.trackSurface(createSurface('1234:5678', true), 'test-instance:/dev/hidraw0', mockOpener)

		expect(id).toBe('1234:5678-dev1')
	})

	test('deduplicates multiple endpoints of same device', () => {
		const generator = new DiscoveredSurfaceRegistry()

		// Simulate same device with multiple HID endpoints (same path)
		const id1 = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw0', mockOpener)
		const id2 = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw0', mockOpener)
		const id3 = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw0', mockOpener)

		expect(id1).toBe(id2)
		expect(id2).toBe(id3)
	})

	test('handles empty uniqueness key', () => {
		const generator = new DiscoveredSurfaceRegistry()

		const id1 = generator.trackSurface(createSurface('', false), 'test-instance:/dev/hidraw0', mockOpener)
		const id2 = generator.trackSurface(createSurface('', false), 'test-instance:/dev/hidraw1', mockOpener)

		expect(id1).not.toBe(id2)
		expect(id1).toBe('')
		expect(id2).toBe('-dev2')
	})

	test('real-world scenario: 2 identical Stream Decks', () => {
		const generator = new DiscoveredSurfaceRegistry()

		// Same vendor:product, different USB paths
		const deck1 = generator.trackSurface(createSurface('4057:96', false), 'test-instance:/dev/hidraw0', mockOpener)
		const deck2 = generator.trackSurface(createSurface('4057:96', false), 'test-instance:/dev/hidraw1', mockOpener)

		expect(deck1).not.toBe(deck2)
		expect(deck1).toBe('4057:96')
		expect(deck2).toBe('4057:96-dev2')

		// Re-enumerating same devices should return same IDs
		expect(generator.trackSurface(createSurface('4057:96', false), 'test-instance:/dev/hidraw0', mockOpener)).toBe(
			deck1
		)
		expect(generator.trackSurface(createSurface('4057:96', false), 'test-instance:/dev/hidraw1', mockOpener)).toBe(
			deck2
		)
	})

	test('prepareForScan removes devices not seen in current scan', () => {
		const generator = new DiscoveredSurfaceRegistry()

		// First scan: 3 devices
		const id1 = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw0', mockOpener)
		const id2 = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw1', mockOpener)
		const id3 = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw2', mockOpener)

		expect(id1).toBe('1234:5678')
		expect(id2).toBe('1234:5678-dev2')
		expect(id3).toBe('1234:5678-dev3')

		// Second scan: only 2 devices (hidraw1 disconnected)
		generator.prepareForScan(
			new Set(['/dev/hidraw0', '/dev/hidraw2'].map((p) => `test-instance:${p}` as `${string}:${string}`))
		)
		const id1Again = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw0', mockOpener)
		const id3Again = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw2', mockOpener)

		// IDs should be preserved for devices still present
		expect(id1Again).toBe(id1)
		expect(id3Again).toBe(id3)

		// Third scan: hidraw1 reconnects, should get a new ID
		generator.prepareForScan(
			new Set(
				['/dev/hidraw0', '/dev/hidraw1', '/dev/hidraw2'].map((p) => `test-instance:${p}` as `${string}:${string}`)
			)
		)
		const id1Third = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw0', mockOpener)
		const id2Reconnect = generator.trackSurface(
			createSurface('1234:5678', false),
			'test-instance:/dev/hidraw1',
			mockOpener
		)
		const id3Third = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw2', mockOpener)

		expect(id1Third).toBe(id1)
		expect(id3Third).toBe(id3)
		// After pruning and re-adding, collision avoidance assigns next available counter
		expect(id2Reconnect).toBe('1234:5678-dev2')
	})

	test('prepareForScan clears scan tracking sets', () => {
		const generator = new DiscoveredSurfaceRegistry()

		// First scan
		const id1 = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw0', mockOpener)
		const id2 = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw1', mockOpener)

		// Second scan - should be able to reuse index 0, 1 etc
		generator.prepareForScan(
			new Set(['/dev/hidraw3', '/dev/hidraw4'].map((p) => `test-instance:${p}` as `${string}:${string}`))
		)
		const id3 = generator.trackSurface(createSurface('5678:1234', false), 'test-instance:/dev/hidraw3', mockOpener)
		const id4 = generator.trackSurface(createSurface('5678:1234', false), 'test-instance:/dev/hidraw4', mockOpener)

		// All should be unique
		expect(new Set([id1, id2, id3, id4]).size).toBe(4)
	})

	test('state preserved across multiple scan cycles', () => {
		const generator = new DiscoveredSurfaceRegistry()

		// Scan 1: 3 devices
		const scan1_dev0 = generator.trackSurface(
			createSurface('1234:5678', false),
			'test-instance:/dev/hidraw0',
			mockOpener
		)
		const scan1_dev1 = generator.trackSurface(
			createSurface('1234:5678', false),
			'test-instance:/dev/hidraw1',
			mockOpener
		)
		const scan1_dev2 = generator.trackSurface(
			createSurface('1234:5678', false),
			'test-instance:/dev/hidraw2',
			mockOpener
		)

		// Scan 2: same 3 devices
		generator.prepareForScan(
			new Set(
				['/dev/hidraw0', '/dev/hidraw1', '/dev/hidraw2'].map((p) => `test-instance:${p}` as `${string}:${string}`)
			)
		)
		const scan2_dev0 = generator.trackSurface(
			createSurface('1234:5678', false),
			'test-instance:/dev/hidraw0',
			mockOpener
		)
		const scan2_dev1 = generator.trackSurface(
			createSurface('1234:5678', false),
			'test-instance:/dev/hidraw1',
			mockOpener
		)
		const scan2_dev2 = generator.trackSurface(
			createSurface('1234:5678', false),
			'test-instance:/dev/hidraw2',
			mockOpener
		)

		// Scan 3: same 3 devices
		generator.prepareForScan(
			new Set(
				['/dev/hidraw0', '/dev/hidraw1', '/dev/hidraw2'].map((p) => `test-instance:${p}` as `${string}:${string}`)
			)
		)
		const scan3_dev0 = generator.trackSurface(
			createSurface('1234:5678', false),
			'test-instance:/dev/hidraw0',
			mockOpener
		)
		const scan3_dev1 = generator.trackSurface(
			createSurface('1234:5678', false),
			'test-instance:/dev/hidraw1',
			mockOpener
		)
		const scan3_dev2 = generator.trackSurface(
			createSurface('1234:5678', false),
			'test-instance:/dev/hidraw2',
			mockOpener
		)

		// All scans should return identical IDs for same paths
		expect(scan2_dev0).toBe(scan1_dev0)
		expect(scan2_dev1).toBe(scan1_dev1)
		expect(scan2_dev2).toBe(scan1_dev2)
		expect(scan3_dev0).toBe(scan1_dev0)
		expect(scan3_dev1).toBe(scan1_dev1)
		expect(scan3_dev2).toBe(scan1_dev2)
	})

	test('device reconnection at different path gets new serial', () => {
		const generator = new DiscoveredSurfaceRegistry()

		// Scan 1: device at hidraw0
		const id1 = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw0', mockOpener)
		expect(id1).toBe('1234:5678')

		// Scan 2: same device type reconnects at different path
		generator.prepareForScan(new Set(['/dev/hidraw5'].map((p) => `test-instance:${p}` as `${string}:${string}`)))
		const id2 = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw5', mockOpener)

		// Gets same serial because it's the first device for this uniqueness key again
		expect(id2).toBe('1234:5678')

		// But now if we add another device of same type, it gets different ID
		const id3 = generator.trackSurface(createSurface('1234:5678', false), 'test-instance:/dev/hidraw6', mockOpener)
		expect(id3).toBe('1234:5678-dev2')
	})

	test('handles partial device changes between scans', () => {
		const generator = new DiscoveredSurfaceRegistry()

		// Scan 1: 4 devices
		const dev0_scan1 = generator.trackSurface(
			createSurface('1234:5678', false),
			'test-instance:/dev/hidraw0',
			mockOpener
		)
		const _dev1_scan1 = generator.trackSurface(
			createSurface('1234:5678', false),
			'test-instance:/dev/hidraw1',
			mockOpener
		)
		const _dev2_scan1 = generator.trackSurface(
			createSurface('1234:5678', false),
			'test-instance:/dev/hidraw2',
			mockOpener
		)
		const dev3_scan1 = generator.trackSurface(
			createSurface('1234:5678', false),
			'test-instance:/dev/hidraw3',
			mockOpener
		)

		// Scan 2: hidraw1 and hidraw2 removed, hidraw4 added
		generator.prepareForScan(
			new Set(
				['/dev/hidraw0', '/dev/hidraw3', '/dev/hidraw4'].map((p) => `test-instance:${p}` as `${string}:${string}`)
			)
		)
		const dev0_scan2 = generator.trackSurface(
			createSurface('1234:5678', false),
			'test-instance:/dev/hidraw0',
			mockOpener
		)
		const dev3_scan2 = generator.trackSurface(
			createSurface('1234:5678', false),
			'test-instance:/dev/hidraw3',
			mockOpener
		)
		const dev4_scan2 = generator.trackSurface(
			createSurface('1234:5678', false),
			'test-instance:/dev/hidraw4',
			mockOpener
		)

		// Persistent devices keep their IDs
		expect(dev0_scan2).toBe(dev0_scan1)
		expect(dev3_scan2).toBe(dev3_scan1)

		// New device gets next available serial
		expect(dev4_scan2).not.toBe(dev0_scan1)
		expect(dev4_scan2).not.toBe(dev3_scan1)

		// All current IDs are unique
		expect(new Set([dev0_scan2, dev3_scan2, dev4_scan2]).size).toBe(3)
	})

	test('multiple device types tracked independently', () => {
		const generator = new DiscoveredSurfaceRegistry()

		// Scan 1: different device types
		const typeA_dev0 = generator.trackSurface(
			createSurface('1111:2222', false),
			'test-instance:/dev/hidraw0',
			mockOpener
		)
		const typeB_dev1 = generator.trackSurface(
			createSurface('3333:4444', false),
			'test-instance:/dev/hidraw1',
			mockOpener
		)
		const _typeA_dev2 = generator.trackSurface(
			createSurface('1111:2222', false),
			'test-instance:/dev/hidraw2',
			mockOpener
		)

		// Scan 2: one device of each type removed
		generator.prepareForScan(
			new Set(['/dev/hidraw0', '/dev/hidraw1'].map((p) => `test-instance:${p}` as `${string}:${string}`))
		)
		const typeA_dev0_s2 = generator.trackSurface(
			createSurface('1111:2222', false),
			'test-instance:/dev/hidraw0',
			mockOpener
		)
		const typeB_dev1_s2 = generator.trackSurface(
			createSurface('3333:4444', false),
			'test-instance:/dev/hidraw1',
			mockOpener
		)

		// IDs should be preserved
		expect(typeA_dev0_s2).toBe(typeA_dev0)
		expect(typeB_dev1_s2).toBe(typeB_dev1)

		// Scan 3: add another typeA device at new path
		generator.prepareForScan(
			new Set(
				['/dev/hidraw0', '/dev/hidraw1', '/dev/hidraw3'].map((p) => `test-instance:${p}` as `${string}:${string}`)
			)
		)
		const typeA_dev0_s3 = generator.trackSurface(
			createSurface('1111:2222', false),
			'test-instance:/dev/hidraw0',
			mockOpener
		)
		const typeB_dev1_s3 = generator.trackSurface(
			createSurface('3333:4444', false),
			'test-instance:/dev/hidraw1',
			mockOpener
		)
		const typeA_dev3_s3 = generator.trackSurface(
			createSurface('1111:2222', false),
			'test-instance:/dev/hidraw3',
			mockOpener
		)

		expect(typeA_dev0_s3).toBe(typeA_dev0)
		expect(typeB_dev1_s3).toBe(typeB_dev1)
		// New path for typeA gets next available serial
		expect(typeA_dev3_s3).not.toBe(typeA_dev0)
		// All current devices have unique IDs
		expect(new Set([typeA_dev0_s3, typeB_dev1_s3, typeA_dev3_s3]).size).toBe(3)
	})
})
