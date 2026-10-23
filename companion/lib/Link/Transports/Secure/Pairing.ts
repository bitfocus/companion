import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'

/**
 * The pairing protocol: the frames exchanged over a secure channel before it is trusted, and the pairing code. How
 * pairing works, and why, is explained in the README. PairingSession.ts runs it.
 */

/** A random nonce, or a commitment to one, as hex */
const NonceSchema = z.string().regex(/^[0-9a-f]{64}$/)

/** Messages exchanged over the encrypted channel before the link is established */
export const AuthFrameSchema = z.discriminatedUnion('op', [
	/** From the connecting end, first: whether it has paired with the accepting end */
	z.object({ op: z.literal('auth-request'), paired: z.boolean() }),
	z.object({
		op: z.literal('auth'),
		/**
		 * - `paired`: the connection is trusted, Link messages can flow
		 * - `rejected`: the user rejected the pairing, or entered the wrong code too often
		 * - `expired`: the request timed out, or a newer one took its place
		 * - `busy`: too many requests are waiting, try again later
		 */
		status: z.enum(['paired', 'rejected', 'expired', 'busy']),
	}),
	/** From the accepting end, when pairing is needed: its commitment to its nonce */
	z.object({ op: z.literal('pairing-commit'), commit: NonceSchema }),
	/** From the connecting end, in answer to the commitment: its nonce */
	z.object({ op: z.literal('pairing-nonce'), nonce: NonceSchema }),
	/** From the accepting end: its nonce, after which the connecting end shows the code */
	z.object({ op: z.literal('pairing-reveal'), nonce: NonceSchema }),
])
export type AuthFrame = z.infer<typeof AuthFrameSchema>

/** Parse a frame received before the link is established, or null if it isn't one */
export function parseAuthFrame(text: string): AuthFrame | null {
	try {
		const parsed = AuthFrameSchema.safeParse(JSON.parse(text))
		return parsed.success ? parsed.data : null
	} catch {
		return null
	}
}

/** Number of digits in a pairing code */
const PAIRING_CODE_DIGITS = 8

/** A random nonce for pairing */
export function createPairingNonce(): string {
	return randomBytes(32).toString('hex')
}

/** The commitment to a nonce, sent before the nonce is revealed */
export function commitPairingNonce(nonce: string): string {
	return createHash('sha256').update('companion-link-pairing-commit').update(nonce, 'hex').digest('hex')
}

/**
 * Derive the pairing code both ends show/expect, formatted as `1234-5678`
 * @param acceptingNonce - the nonce of the accepting end, which it committed to
 * @param connectingNonce - the nonce of the connecting end
 */
export function derivePairingCode(handshakeHash: Uint8Array, acceptingNonce: string, connectingNonce: string): string {
	const digest = createHash('sha256')
		.update('companion-link-pairing')
		.update(handshakeHash)
		.update(acceptingNonce, 'hex')
		.update(connectingNonce, 'hex')
		.digest()
	const value = digest.readBigUInt64BE(0) % 10n ** BigInt(PAIRING_CODE_DIGITS)
	const digits = value.toString().padStart(PAIRING_CODE_DIGITS, '0')
	return `${digits.slice(0, 4)}-${digits.slice(4)}`
}

/** Normalise a code typed by the user, so that separators and spaces don't matter */
export function normalisePairingCode(code: string): string {
	return code.replace(/\D/g, '')
}
