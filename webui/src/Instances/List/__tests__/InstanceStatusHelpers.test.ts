import { describe, expect, it } from 'vitest'
import { instanceStatusTone, isInstanceStatusConnecting } from '../InstanceStatusHelpers.js'

describe('isInstanceStatusConnecting', () => {
	it('treats a missing or category-less status as connecting', () => {
		expect(isInstanceStatusConnecting(undefined)).toBe(true)
		expect(isInstanceStatusConnecting({ category: null, level: null, message: null })).toBe(true)
	})

	it('treats an error at level Connecting as connecting', () => {
		expect(isInstanceStatusConnecting({ category: 'error', level: 'Connecting', message: 'Dialing…' })).toBe(true)
	})

	it('does not treat other statuses as connecting', () => {
		expect(isInstanceStatusConnecting({ category: 'error', level: 'Connection Failure', message: null })).toBe(false)
		expect(isInstanceStatusConnecting({ category: 'warning', level: 'Connecting', message: null })).toBe(false)
		expect(isInstanceStatusConnecting({ category: 'good', level: null, message: null })).toBe(false)
	})
})

describe('instanceStatusTone', () => {
	it('uses neutral before any status, and info while a module reports connecting', () => {
		expect(instanceStatusTone(undefined)).toBe('neutral')
		expect(instanceStatusTone({ category: 'error', level: 'Connecting', message: null })).toBe('info')
	})

	it('maps the module categories to their tones', () => {
		expect(instanceStatusTone({ category: 'good', level: null, message: null })).toBe('good')
		expect(instanceStatusTone({ category: 'warning', level: null, message: null })).toBe('warning')
		expect(instanceStatusTone({ category: 'error', level: 'Connection Failure', message: null })).toBe('error')
		expect(instanceStatusTone({ category: 'unknown', level: null, message: null })).toBe('error')
	})
})
