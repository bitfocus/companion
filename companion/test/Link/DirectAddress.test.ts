import { describe, expect, test } from 'vitest'
import { formatRemoteAddress, remoteHostKey, resolveDirectAddress } from '../../lib/Link/Transports/Direct/Address.js'

describe('resolveDirectAddress', () => {
	test.each([
		['192.168.1.10', 'ws://192.168.1.10:16624/'],
		[' studio-a.local ', 'ws://studio-a.local:16624/'],
		['studio-a.local:1234', 'ws://studio-a.local:1234/'],
		['[fe80::1]', 'ws://[fe80::1]:16624/'],
		['[fe80::1]:1234', 'ws://[fe80::1]:1234/'],
		['fe80::1', 'ws://[fe80::1]:16624/'],
		['ws://10.0.0.1:5000', 'ws://10.0.0.1:5000/'],
		['wss://proxy.example.com/companion/link', 'wss://proxy.example.com/companion/link'],
		['https://proxy.example.com/sub/', 'wss://proxy.example.com/sub/'],
		['http://proxy.example.com:8080/sub?key=1', 'ws://proxy.example.com:8080/sub?key=1'],
	])('%s → %s', (input, expected) => {
		expect(resolveDirectAddress(input, 16624)).toEqual({ ok: true, url: expected })
	})

	test.each([[''], ['   '], ['ftp://example.com'], ['host:99999'], ['some host'], ['host/path']])(
		'%s is rejected',
		(input) => {
			expect(resolveDirectAddress(input, 16624).ok).toBe(false)
		}
	)
})

describe('formatRemoteAddress', () => {
	test.each([
		['::ffff:127.0.0.1', 54846, '127.0.0.1:54846'],
		['192.168.1.10', 1234, '192.168.1.10:1234'],
		['::1', 1234, '[::1]:1234'],
		['fe80::1', 1234, '[fe80::1]:1234'],
		// Only the prefix of an IPv4-mapped address is dropped
		['::ffff:abcd', 1234, '[::ffff:abcd]:1234'],
	])('%s, port %s → %s', (ip, port, expected) => {
		expect(formatRemoteAddress(ip, port)).toBe(expected)
	})
})

describe('remoteHostKey', () => {
	test.each([
		['192.168.1.10', '192.168.1.10'],
		['::ffff:192.168.1.10', '192.168.1.10'],
		['2001:db8:1:2:3:4:5:6', '2001:db8:1:2::/64'],
		['2001:db8:1:2::7', '2001:db8:1:2::/64'],
		['2001:db8::1:2:3:4:5', '2001:db8:0:1::/64'],
		['fe80::1%eth0', 'fe80:0:0:0::/64'],
		['::1', '0:0:0:0::/64'],
	])('%s → %s', (ip, expected) => {
		expect(remoteHostKey(ip)).toBe(expected)
	})
})
