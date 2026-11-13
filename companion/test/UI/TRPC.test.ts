import { EventEmitter } from 'node:events'
import os from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computeIsLocalClient, throttleIterator, toIterable } from '../../lib/UI/TRPC.js'

describe('computeIsLocalClient', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	function mockInterfaces(addresses: string[]): void {
		vi.spyOn(os, 'networkInterfaces').mockReturnValue({
			eth0: addresses.map((address) => ({
				address,
				netmask: '255.255.255.0',
				family: address.includes(':') ? 'IPv6' : 'IPv4',
				mac: '00:00:00:00:00:00',
				internal: false,
				cidr: null,
			})) as os.NetworkInterfaceInfo[],
		})
	}

	it('returns false for an undefined address', () => {
		expect(computeIsLocalClient(undefined)).toBe(false)
	})

	it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1'])('treats loopback %s as local', (ip) => {
		mockInterfaces([])
		expect(computeIsLocalClient(ip)).toBe(true)
	})

	it('treats an address belonging to a local interface as local', () => {
		mockInterfaces(['192.168.1.50'])
		expect(computeIsLocalClient('192.168.1.50')).toBe(true)
	})

	it('matches the IPv4-mapped IPv6 form against a local interface', () => {
		mockInterfaces(['192.168.1.50'])
		expect(computeIsLocalClient('::ffff:192.168.1.50')).toBe(true)
	})

	it('strips an IPv6 zone id before comparing', () => {
		mockInterfaces(['fe80::1'])
		expect(computeIsLocalClient('fe80::1%eth0')).toBe(true)
	})

	it('returns false for a remote address', () => {
		mockInterfaces(['192.168.1.50'])
		expect(computeIsLocalClient('10.0.0.99')).toBe(false)
	})

	it('returns false when reading the network interfaces throws', () => {
		vi.spyOn(os, 'networkInterfaces').mockImplementation(() => {
			throw new Error('boom')
		})
		expect(computeIsLocalClient('192.168.1.50')).toBe(false)
	})
})

describe('throttleIterator', () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	function setup() {
		vi.useFakeTimers()
		const ee = new EventEmitter<{ value: [number] }>()
		const abort = new AbortController()
		const iterator = throttleIterator(toIterable(ee, 'value', abort.signal), 100)
		return { ee, abort, iterator }
	}

	it('passes on a value straight away, then only the latest of those within the interval', async () => {
		const { ee, iterator } = setup()

		const first = iterator.next()
		ee.emit('value', 1)
		expect(await first).toEqual({ done: false, value: [1] })

		const second = iterator.next()
		ee.emit('value', 2)
		ee.emit('value', 3)
		await vi.advanceTimersByTimeAsync(99)
		ee.emit('value', 4)
		await vi.advanceTimersByTimeAsync(1)
		expect(await second).toEqual({ done: false, value: [4] })

		await iterator.return()
	})

	it('passes on a value straight away once an interval has passed without any', async () => {
		const { ee, iterator } = setup()

		const first = iterator.next()
		ee.emit('value', 1)
		await first
		await vi.advanceTimersByTimeAsync(500)

		const second = iterator.next()
		ee.emit('value', 2)
		expect(await second).toEqual({ done: false, value: [2] })

		await iterator.return()
	})

	it('stops listening once returned', async () => {
		const { ee, iterator } = setup()

		const first = iterator.next()
		ee.emit('value', 1)
		await first
		await iterator.return()

		expect(ee.listenerCount('value')).toBe(0)
	})

	it('ends when the signal aborts', async () => {
		const { ee, abort, iterator } = setup()

		const first = iterator.next()
		abort.abort()
		await expect(first).rejects.toThrow()
		expect(ee.listenerCount('value')).toBe(0)
	})
})
