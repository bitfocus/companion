import { describe, expect, it } from 'vitest'
import { formatFileSize, getDataUrlByteSize } from '../FileUpload.js'

describe('getDataUrlByteSize', () => {
	it('computes the decoded size of a base64 payload', () => {
		expect(getDataUrlByteSize('data:image/png;base64,' + btoa('abc'))).toBe(3)
		expect(getDataUrlByteSize('data:image/png;base64,' + btoa('abcd'))).toBe(4)
		expect(getDataUrlByteSize('data:image/png;base64,' + btoa('abcde'))).toBe(5)
		expect(getDataUrlByteSize('data:image/png;base64,')).toBe(0)
	})

	it('matches the length of a larger payload', () => {
		const payload = 'x'.repeat(10_001)
		expect(getDataUrlByteSize('data:image/gif;base64,' + btoa(payload))).toBe(payload.length)
	})

	it('uses the character count for a non-base64 payload', () => {
		expect(getDataUrlByteSize('data:image/svg+xml,%3Csvg%3E')).toBe(9)
	})

	it('falls back to the string length when there is no payload separator', () => {
		expect(getDataUrlByteSize('not-a-data-url')).toBe(14)
	})
})

describe('formatFileSize', () => {
	it('formats sizes', () => {
		expect(formatFileSize(0)).toBe('0 Bytes')
		expect(formatFileSize(512)).toBe('512 Bytes')
		expect(formatFileSize(512 * 1024)).toBe('512 KB')
		expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB')
	})
})
