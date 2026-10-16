import { createHash } from 'node:crypto'
import { z } from 'zod'

/**
 * Pairing of direct connections.
 *
 * Every connection starts with a Noise XX handshake, after which both ends know each other's static public key, and
 * share a hash of the handshake. A man in the middle would have to run a separate handshake with each end, so the
 * hashes would differ.
 *
 * The first time two installations connect, the accepting end doesn't know the connecting end's key, so it asks for
 * pairing. Both ends derive a short code from the handshake hash: the connecting end shows it, and the user types
 * it in on the accepting end, which accepts only if it matches its own. Each end then remembers the other's key,
 * so later connections need no code, and a different key is refused.
 */

/** Messages exchanged over the encrypted channel before the link is established */
export const DirectAuthFrameSchema = z.discriminatedUnion('op', [
	z.object({
		op: z.literal('auth'),
		/**
		 * - `paired`: the connection is trusted, Link messages can flow
		 * - `pairing-required`: the user must enter the pairing code on the accepting end
		 * - `rejected`: the user rejected the pairing, or entered the wrong code too often
		 */
		status: z.enum(['paired', 'pairing-required', 'rejected']),
	}),
])
export type DirectAuthFrame = z.infer<typeof DirectAuthFrameSchema>

/** Number of digits in a pairing code */
const PAIRING_CODE_DIGITS = 8

/** Derive the pairing code both ends show/expect from the handshake hash, formatted as `1234-5678` */
export function derivePairingCode(handshakeHash: Buffer): string {
	const digest = createHash('sha256').update('companion-link-direct-pairing').update(handshakeHash).digest()
	const value = digest.readBigUInt64BE(0) % 10n ** BigInt(PAIRING_CODE_DIGITS)
	const digits = value.toString().padStart(PAIRING_CODE_DIGITS, '0')
	return `${digits.slice(0, 4)}-${digits.slice(4)}`
}

/** Normalise a code typed by the user, so that separators and spaces don't matter */
export function normalisePairingCode(code: string): string {
	return code.replace(/\D/g, '')
}

/** A short, readable form of a public key, for the user to recognise an installation by */
export function formatKeyFingerprint(publicKeyHex: string): string {
	return publicKeyHex.slice(0, 16).toUpperCase().match(/.{4}/g)?.join(' ') ?? publicKeyHex
}
