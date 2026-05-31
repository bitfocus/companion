import { describe, expect, test } from 'vitest'
import { computeElementContentHash } from '../../../lib/Graphics/ConvertGraphicsElements/Util.js'

describe('computeElementContentHash', () => {
	test('returns a 64-character hex string', () => {
		const hash = computeElementContentHash({ type: 'text' } as any)
		expect(hash).toMatch(/^[0-9a-f]{64}$/)
	})

	test('is deterministic: same input always produces the same hash', () => {
		const obj = { type: 'text', color: 0xff0000, fontsize: 'auto' } as any
		expect(computeElementContentHash(obj)).toBe(computeElementContentHash(obj))
	})

	test('key ordering does not affect the hash', () => {
		const a = computeElementContentHash({ type: 'text', color: 0xff0000 } as any)
		const b = computeElementContentHash({ color: 0xff0000, type: 'text' } as any)
		expect(a).toBe(b)
	})

	test('different values for the same key produce different hashes', () => {
		const a = computeElementContentHash({ type: 'text' } as any)
		const b = computeElementContentHash({ type: 'box' } as any)
		expect(a).not.toBe(b)
	})

	test('excludes the id field from the hash', () => {
		const a = computeElementContentHash({ id: 'elem-aaa', type: 'text' } as any)
		const b = computeElementContentHash({ id: 'elem-bbb', type: 'text' } as any)
		expect(a).toBe(b)
	})

	test('excludes the contentHash field from the hash', () => {
		const a = computeElementContentHash({ type: 'text', contentHash: 'old-hash' } as any)
		const b = computeElementContentHash({ type: 'text', contentHash: 'new-hash' } as any)
		expect(a).toBe(b)
	})

	test('excludes the children field from the hash', () => {
		const a = computeElementContentHash({ type: 'group', children: [] } as any)
		const b = computeElementContentHash({ type: 'group', children: ['child-a', 'child-b'] } as any)
		expect(a).toBe(b)
	})

	test('handles null values without throwing', () => {
		const hash = computeElementContentHash({ type: 'image', base64Image: null } as any)
		expect(hash).toMatch(/^[0-9a-f]{64}$/)
	})

	test('distinguishes null from undefined', () => {
		const a = computeElementContentHash({ type: 'image', base64Image: null } as any)
		const b = computeElementContentHash({ type: 'image', base64Image: undefined } as any)
		expect(a).not.toBe(b)
	})

	test('handles boolean values', () => {
		const a = computeElementContentHash({ type: 'text', enabled: true } as any)
		const b = computeElementContentHash({ type: 'text', enabled: false } as any)
		expect(a).not.toBe(b)
	})

	test('handles nested object values', () => {
		const a = computeElementContentHash({ type: 'text', style: { color: 'red' } } as any)
		const b = computeElementContentHash({ type: 'text', style: { color: 'blue' } } as any)
		expect(a).not.toBe(b)
	})

	test('handles array values', () => {
		const a = computeElementContentHash({ type: 'text', tags: ['a', 'b'] } as any)
		const b = computeElementContentHash({ type: 'text', tags: ['a', 'c'] } as any)
		expect(a).not.toBe(b)
	})

	test('empty object produces a valid hash', () => {
		const hash = computeElementContentHash({} as any)
		expect(hash).toMatch(/^[0-9a-f]{64}$/)
	})
})
