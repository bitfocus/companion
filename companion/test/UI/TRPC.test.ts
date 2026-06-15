import os from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computeIsLocalClient } from '../../lib/UI/TRPC.js'

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
