import { describe, expect, it } from 'vitest'
import {
	mangleReferenceSurfaceId,
	MAX_REFERENCE_DEPTH,
	referenceSurfaceIdDepth,
	stripReferenceSurfaceId,
} from '../../lib/Surface/ReferenceSurfaceId.js'

describe('ReferenceSurfaceId', () => {
	describe('mangleReferenceSurfaceId', () => {
		it('appends the reference control id', () => {
			const mangled = mangleReferenceSurfaceId('streamdeck:ABC123', 'bank:1-0-0')
			expect(mangled).toContain('streamdeck:ABC123')
			expect(mangled).toContain('bank:1-0-0')
			expect(mangled).not.toBe('streamdeck:ABC123')
		})

		it('passes undefined through unchanged (a no-surface press)', () => {
			expect(mangleReferenceSurfaceId(undefined, 'bank:1-0-0')).toBeUndefined()
		})

		it('is reversible via strip regardless of hop count', () => {
			let id: string | undefined = 'emulator:emulator'
			id = mangleReferenceSurfaceId(id, 'bank:1-0-0')
			id = mangleReferenceSurfaceId(id, 'bank:2-0-0')
			expect(stripReferenceSurfaceId(id!)).toBe('emulator:emulator')
		})
	})

	describe('stripReferenceSurfaceId', () => {
		it.each(['streamdeck:ABC123', 'emulator:emulator', 'satellite-abc-def', 'self', 'osc', 'context-menu'])(
			'is a no-op on the unmangled real id %s',
			(realId) => {
				expect(stripReferenceSurfaceId(realId)).toBe(realId)
			}
		)

		it('recovers the real id after a single hop', () => {
			const mangled = mangleReferenceSurfaceId('streamdeck:ABC123', 'bank:1-0-0')!
			expect(stripReferenceSurfaceId(mangled)).toBe('streamdeck:ABC123')
		})
	})

	describe('referenceSurfaceIdDepth', () => {
		it('is 0 for an unmangled id and for undefined', () => {
			expect(referenceSurfaceIdDepth('streamdeck:ABC123')).toBe(0)
			expect(referenceSurfaceIdDepth(undefined)).toBe(0)
		})

		it('counts each reference hop', () => {
			let id: string | undefined = 'emulator:emulator'
			for (let i = 1; i <= 3; i++) {
				id = mangleReferenceSurfaceId(id, `bank:${i}-0-0`)
				expect(referenceSurfaceIdDepth(id)).toBe(i)
			}
		})

		it('exposes a sane max depth for the loop guard', () => {
			expect(MAX_REFERENCE_DEPTH).toBeGreaterThan(0)
		})
	})
})
