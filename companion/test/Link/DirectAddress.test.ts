import { describe, expect, test } from 'vitest'
import { resolveDirectAddress } from '../../lib/Link/Transports/Direct/Address.js'

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
