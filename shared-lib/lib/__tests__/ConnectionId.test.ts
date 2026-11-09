import { describe, expect, test } from 'vitest'
import {
	getVirtualConnectionIds,
	INTERNAL_CONNECTION_ID,
	isInternalConnectionId,
	isVirtualConnectionId,
} from '../ConnectionId.js'

describe('isInternalConnectionId', () => {
	test('internal', () => {
		expect(isInternalConnectionId(INTERNAL_CONNECTION_ID)).toBe(true)
		expect(isInternalConnectionId('internal')).toBe(true)
	})

	test('other ids', () => {
		expect(isInternalConnectionId('abc123')).toBe(false)
		expect(isInternalConnectionId('Internal')).toBe(false)
		expect(isInternalConnectionId('')).toBe(false)
		expect(isInternalConnectionId(null)).toBe(false)
		expect(isInternalConnectionId(undefined)).toBe(false)
	})
})

describe('isVirtualConnectionId', () => {
	test('internal is virtual', () => {
		expect(isVirtualConnectionId(INTERNAL_CONNECTION_ID)).toBe(true)
	})

	test('user connections are not virtual', () => {
		expect(isVirtualConnectionId('abc123')).toBe(false)
		expect(isVirtualConnectionId('')).toBe(false)
		expect(isVirtualConnectionId(null)).toBe(false)
		expect(isVirtualConnectionId(undefined)).toBe(false)
	})

	test('matches the list of virtual ids', () => {
		for (const id of getVirtualConnectionIds()) {
			expect(isVirtualConnectionId(id)).toBe(true)
		}
		expect(getVirtualConnectionIds().has(INTERNAL_CONNECTION_ID)).toBe(true)
	})
})
