import { StableDeviceIdGenerator } from '../../../lib/Instance/Surface/StableDeviceIdGenerator.js'
import { describe, expect, test } from 'vitest'

describe('StableDeviceIdGenerator', () => {
	test('generates different IDs for different uniqueness keys', () => {
		const generator = new StableDeviceIdGenerator()

		const id1 = generator.generateId('1234:5678', false, '/dev/hidraw0')
		const id2 = generator.generateId('1234:9999', false, '/dev/hidraw1')

		expect(id1).not.toBe(id2)
		expect(id1).toBe('1234:5678')
		expect(id2).toBe('1234:9999')
	})

	test('generates different IDs for same uniqueness key with different paths', () => {
		const generator = new StableDeviceIdGenerator()

		const id1 = generator.generateId('1234:5678', false, '/dev/hidraw0')
		const id2 = generator.generateId('1234:5678', false, '/dev/hidraw1')

		expect(id1).not.toBe(id2)
		expect(id1).toBe('1234:5678')
		expect(id2).toBe('1234:5678-dev2')
	})

	test('returns same ID for same device path on repeated calls', () => {
		const generator = new StableDeviceIdGenerator()

		const id1 = generator.generateId('1234:5678', false, '/dev/hidraw0')
		const id2 = generator.generateId('1234:5678', false, '/dev/hidraw0')

		expect(id1).toBe(id2)
	})

	test('generates stable IDs with counter increment', () => {
		const generator = new StableDeviceIdGenerator()

		const id1 = generator.generateId('1234:5678', false, '/dev/hidraw0')
		const id2 = generator.generateId('1234:5678', false, '/dev/hidraw1')
		const id3 = generator.generateId('1234:5678', false, '/dev/hidraw2')

		// All should be unique
		expect(new Set([id1, id2, id3]).size).toBe(3)
		expect(id1).toBe('1234:5678')
		expect(id2).toBe('1234:5678-dev2')
		expect(id3).toBe('1234:5678-dev3')
	})

	test('separate instances have independent state', () => {
		const generator1 = new StableDeviceIdGenerator()
		const generator2 = new StableDeviceIdGenerator()

		const id1 = generator1.generateId('1234:5678', false, '/dev/hidraw0')
		const id2 = generator2.generateId('1234:5678', false, '/dev/hidraw1')

		// Different instances generate independently
		expect(id1).toBe('1234:5678')
		expect(id2).toBe('1234:5678')
	})

	test('handles multiple devices with same uniqueness key in batch', () => {
		const generator = new StableDeviceIdGenerator()

		// Simulate 3 identical devices (same vendor/product) with different paths
		const ids = [
			generator.generateId('1234:5678', false, '/dev/hidraw0'),
			generator.generateId('1234:5678', false, '/dev/hidraw1'),
			generator.generateId('1234:5678', false, '/dev/hidraw2'),
		]

		// All should be unique
		expect(new Set(ids).size).toBe(3)
		expect(ids[0]).toBe('1234:5678')
		expect(ids[1]).toBe('1234:5678-dev2')
		expect(ids[2]).toBe('1234:5678-dev3')

		// Requesting same path again should return cached ID
		expect(generator.generateId('1234:5678', false, '/dev/hidraw1')).toBe(ids[1])
	})

	test('alwaysAddSuffix parameter forces suffix even for first device', () => {
		const generator = new StableDeviceIdGenerator()

		const id = generator.generateId('1234:5678', true, '/dev/hidraw0')

		expect(id).toBe('1234:5678-dev1')
	})

	test('deduplicates multiple endpoints of same device', () => {
		const generator = new StableDeviceIdGenerator()

		// Simulate same device with multiple HID endpoints (same path)
		const id1 = generator.generateId('1234:5678', false, '/dev/hidraw0')
		const id2 = generator.generateId('1234:5678', false, '/dev/hidraw0')
		const id3 = generator.generateId('1234:5678', false, '/dev/hidraw0')

		expect(id1).toBe(id2)
		expect(id2).toBe(id3)
	})

	test('handles empty uniqueness key', () => {
		const generator = new StableDeviceIdGenerator()

		const id1 = generator.generateId('', false, '/dev/hidraw0')
		const id2 = generator.generateId('', false, '/dev/hidraw1')

		expect(id1).not.toBe(id2)
		expect(id1).toBe('')
		expect(id2).toBe('-dev2')
	})

	test('real-world scenario: 2 identical Stream Decks', () => {
		const generator = new StableDeviceIdGenerator()

		// Same vendor:product, different USB paths
		const deck1 = generator.generateId('4057:96', false, '/dev/hidraw0')
		const deck2 = generator.generateId('4057:96', false, '/dev/hidraw1')

		expect(deck1).not.toBe(deck2)
		expect(deck1).toBe('4057:96')
		expect(deck2).toBe('4057:96-dev2')

		// Re-enumerating same devices should return same IDs
		expect(generator.generateId('4057:96', false, '/dev/hidraw0')).toBe(deck1)
		expect(generator.generateId('4057:96', false, '/dev/hidraw1')).toBe(deck2)
	})

	test('prepareForScan removes devices not seen in current scan', () => {
		const generator = new StableDeviceIdGenerator()

		// First scan: 3 devices
		const id1 = generator.generateId('1234:5678', false, '/dev/hidraw0')
		const id2 = generator.generateId('1234:5678', false, '/dev/hidraw1')
		const id3 = generator.generateId('1234:5678', false, '/dev/hidraw2')

		expect(id1).toBe('1234:5678')
		expect(id2).toBe('1234:5678-dev2')
		expect(id3).toBe('1234:5678-dev3')

		// Second scan: only 2 devices (hidraw1 disconnected)
		generator.prepareForScan(new Set(['/dev/hidraw0', '/dev/hidraw2']))
		const id1Again = generator.generateId('1234:5678', false, '/dev/hidraw0')
		const id3Again = generator.generateId('1234:5678', false, '/dev/hidraw2')

		// IDs should be preserved for devices still present
		expect(id1Again).toBe(id1)
		expect(id3Again).toBe(id3)

		// Third scan: hidraw1 reconnects, should get a new ID
		generator.prepareForScan(new Set(['/dev/hidraw0', '/dev/hidraw1', '/dev/hidraw2']))
		const id1Third = generator.generateId('1234:5678', false, '/dev/hidraw0')
		const id2Reconnect = generator.generateId('1234:5678', false, '/dev/hidraw1')
		const id3Third = generator.generateId('1234:5678', false, '/dev/hidraw2')

		expect(id1Third).toBe(id1)
		expect(id3Third).toBe(id3)
		// After pruning and re-adding, collision avoidance assigns next available counter
		expect(id2Reconnect).toBe('1234:5678-dev2')
	})

	test('prepareForScan clears scan tracking sets', () => {
		const generator = new StableDeviceIdGenerator()

		// First scan
		const id1 = generator.generateId('1234:5678', false, '/dev/hidraw0')
		const id2 = generator.generateId('1234:5678', false, '/dev/hidraw1')

		// Second scan - should be able to reuse index 0, 1 etc
		generator.prepareForScan(new Set(['/dev/hidraw3', '/dev/hidraw4']))
		const id3 = generator.generateId('5678:1234', false, '/dev/hidraw3')
		const id4 = generator.generateId('5678:1234', false, '/dev/hidraw4')

		// All should be unique
		expect(new Set([id1, id2, id3, id4]).size).toBe(4)
	})

	test('state preserved across multiple scan cycles', () => {
		const generator = new StableDeviceIdGenerator()

		// Scan 1: 3 devices
		const scan1_dev0 = generator.generateId('1234:5678', false, '/dev/hidraw0')
		const scan1_dev1 = generator.generateId('1234:5678', false, '/dev/hidraw1')
		const scan1_dev2 = generator.generateId('1234:5678', false, '/dev/hidraw2')

		// Scan 2: same 3 devices
		generator.prepareForScan(new Set(['/dev/hidraw0', '/dev/hidraw1', '/dev/hidraw2']))
		const scan2_dev0 = generator.generateId('1234:5678', false, '/dev/hidraw0')
		const scan2_dev1 = generator.generateId('1234:5678', false, '/dev/hidraw1')
		const scan2_dev2 = generator.generateId('1234:5678', false, '/dev/hidraw2')

		// Scan 3: same 3 devices
		generator.prepareForScan(new Set(['/dev/hidraw0', '/dev/hidraw1', '/dev/hidraw2']))
		const scan3_dev0 = generator.generateId('1234:5678', false, '/dev/hidraw0')
		const scan3_dev1 = generator.generateId('1234:5678', false, '/dev/hidraw1')
		const scan3_dev2 = generator.generateId('1234:5678', false, '/dev/hidraw2')

		// All scans should return identical IDs for same paths
		expect(scan2_dev0).toBe(scan1_dev0)
		expect(scan2_dev1).toBe(scan1_dev1)
		expect(scan2_dev2).toBe(scan1_dev2)
		expect(scan3_dev0).toBe(scan1_dev0)
		expect(scan3_dev1).toBe(scan1_dev1)
		expect(scan3_dev2).toBe(scan1_dev2)
	})

	test('device reconnection at different path gets new serial', () => {
		const generator = new StableDeviceIdGenerator()

		// Scan 1: device at hidraw0
		const id1 = generator.generateId('1234:5678', false, '/dev/hidraw0')
		expect(id1).toBe('1234:5678')

		// Scan 2: same device type reconnects at different path
		generator.prepareForScan(new Set(['/dev/hidraw5']))
		const id2 = generator.generateId('1234:5678', false, '/dev/hidraw5')

		// Gets same serial because it's the first device for this uniqueness key again
		expect(id2).toBe('1234:5678')

		// But now if we add another device of same type, it gets different ID
		const id3 = generator.generateId('1234:5678', false, '/dev/hidraw6')
		expect(id3).toBe('1234:5678-dev2')
	})

	test('handles partial device changes between scans', () => {
		const generator = new StableDeviceIdGenerator()

		// Scan 1: 4 devices
		const dev0_scan1 = generator.generateId('1234:5678', false, '/dev/hidraw0')
		const _dev1_scan1 = generator.generateId('1234:5678', false, '/dev/hidraw1')
		const _dev2_scan1 = generator.generateId('1234:5678', false, '/dev/hidraw2')
		const dev3_scan1 = generator.generateId('1234:5678', false, '/dev/hidraw3')

		// Scan 2: hidraw1 and hidraw2 removed, hidraw4 added
		generator.prepareForScan(new Set(['/dev/hidraw0', '/dev/hidraw3', '/dev/hidraw4']))
		const dev0_scan2 = generator.generateId('1234:5678', false, '/dev/hidraw0')
		const dev3_scan2 = generator.generateId('1234:5678', false, '/dev/hidraw3')
		const dev4_scan2 = generator.generateId('1234:5678', false, '/dev/hidraw4')

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
		const generator = new StableDeviceIdGenerator()

		// Scan 1: different device types
		const typeA_dev0 = generator.generateId('1111:2222', false, '/dev/hidraw0')
		const typeB_dev1 = generator.generateId('3333:4444', false, '/dev/hidraw1')
		const _typeA_dev2 = generator.generateId('1111:2222', false, '/dev/hidraw2')

		// Scan 2: one device of each type removed
		generator.prepareForScan(new Set(['/dev/hidraw0', '/dev/hidraw1']))
		const typeA_dev0_s2 = generator.generateId('1111:2222', false, '/dev/hidraw0')
		const typeB_dev1_s2 = generator.generateId('3333:4444', false, '/dev/hidraw1')

		// IDs should be preserved
		expect(typeA_dev0_s2).toBe(typeA_dev0)
		expect(typeB_dev1_s2).toBe(typeB_dev1)

		// Scan 3: add another typeA device at new path
		generator.prepareForScan(new Set(['/dev/hidraw0', '/dev/hidraw1', '/dev/hidraw3']))
		const typeA_dev0_s3 = generator.generateId('1111:2222', false, '/dev/hidraw0')
		const typeB_dev1_s3 = generator.generateId('3333:4444', false, '/dev/hidraw1')
		const typeA_dev3_s3 = generator.generateId('1111:2222', false, '/dev/hidraw3')

		expect(typeA_dev0_s3).toBe(typeA_dev0)
		expect(typeB_dev1_s3).toBe(typeB_dev1)
		// New path for typeA gets next available serial
		expect(typeA_dev3_s3).not.toBe(typeA_dev0)
		// All current devices have unique IDs
		expect(new Set([typeA_dev0_s3, typeB_dev1_s3, typeA_dev3_s3]).size).toBe(3)
	})
})
