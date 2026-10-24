import { describe, expect, test } from 'vitest'
import { getInterfaceOptions } from '../interfaceOptions.js'

const INTERFACES = [
	{ id: '0.0.0.0', label: 'All Interfaces: IPv4 Only' },
	{ id: '127.0.0.1', label: 'localhost: 127.0.0.1' },
]

describe('getInterfaceOptions', () => {
	test('returns the list unchanged when it contains the bound interface', () => {
		expect(getInterfaceOptions(INTERFACES, '127.0.0.1')).toBe(INTERFACES)
	})

	test('shows the bound ip on its own before the list has loaded', () => {
		expect(getInterfaceOptions([], '192.168.1.50')).toEqual([{ id: '192.168.1.50', label: '192.168.1.50' }])
	})

	test('appends a bound interface that is no longer available', () => {
		expect(getInterfaceOptions(INTERFACES, '192.168.1.50')).toEqual([
			...INTERFACES,
			{ id: '192.168.1.50', label: '192.168.1.50 (unavailable)' },
		])
	})

	test('adds nothing when no interface is bound', () => {
		expect(getInterfaceOptions(INTERFACES, '')).toBe(INTERFACES)
	})
})
