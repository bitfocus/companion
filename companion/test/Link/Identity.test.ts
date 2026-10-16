import { describe, expect, test } from 'vitest'
import { formatLinkIdFingerprint, LinkIdentity } from '../../lib/Link/Identity.js'

describe('LinkIdentity', () => {
	test('the id is the public key, and survives being stored', () => {
		const identity = LinkIdentity.generate()
		expect(LinkIdentity.publicKeyOf(identity.id)).toEqual(identity.publicKey)

		const loaded = LinkIdentity.fromStored(identity.toStored())
		expect(loaded?.id).toBe(identity.id)
	})

	test('signatures verify against the id that made them only', () => {
		const a = LinkIdentity.generate()
		const b = LinkIdentity.generate()
		const data = Buffer.from('hello')
		const signature = a.sign(data)

		expect(LinkIdentity.verify(a.id, data, signature)).toBe(true)
		expect(LinkIdentity.verify(b.id, data, signature)).toBe(false)
		expect(LinkIdentity.verify(a.id, Buffer.from('hellO'), signature)).toBe(false)
		expect(LinkIdentity.verify('not-an-id', data, signature)).toBe(false)
	})

	test('rejects invalid stored identities', () => {
		expect(LinkIdentity.fromStored('')).toBeNull()
		expect(LinkIdentity.fromStored('garbage')).toBeNull()
	})
})

describe('formatLinkIdFingerprint', () => {
	test('is short and readable, with dashes so that its end is clear', () => {
		expect(formatLinkIdFingerprint('abcdEF0123456789ffff')).toBe('abcd-EF01-2345-6789')
	})
})
