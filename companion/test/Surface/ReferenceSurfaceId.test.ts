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

		it('mangles a missing surfaceId to a depth-countable id with an empty real part', () => {
			// This is what bounds a surface-less reference cycle: the depth still grows
			const mangled = mangleReferenceSurfaceId(undefined, 'bank:1-0-0')
			expect(referenceSurfaceIdDepth(mangled)).toBe(1)
			expect(stripReferenceSurfaceId(mangled)).toBe('')
		})

		it('grows depth to the cap when forwarded through a surface-less cycle', () => {
			let id = mangleReferenceSurfaceId(undefined, 'bank:1-0-0')
			for (let i = 0; i < MAX_REFERENCE_DEPTH * 2; i++) {
				if (referenceSurfaceIdDepth(id) >= MAX_REFERENCE_DEPTH) break
				id = mangleReferenceSurfaceId(id, 'bank:1-0-0')
			}
			expect(referenceSurfaceIdDepth(id)).toBeGreaterThanOrEqual(MAX_REFERENCE_DEPTH)
		})

		it('is reversible via strip regardless of hop count', () => {
			let id = mangleReferenceSurfaceId('emulator:emulator', 'bank:1-0-0')
			id = mangleReferenceSurfaceId(id, 'bank:2-0-0')
			expect(stripReferenceSurfaceId(id)).toBe('emulator:emulator')
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
			const mangled = mangleReferenceSurfaceId('streamdeck:ABC123', 'bank:1-0-0')
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
