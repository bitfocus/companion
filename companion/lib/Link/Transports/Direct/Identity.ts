import type { NoiseKeyPair } from 'noise-handshake'
import { generateKeyPair } from 'noise-handshake/dh'
import { z } from 'zod'
import type { LinkTransportStorage } from '../Types.js'

const STORAGE_KEY = 'identity'
const StoredIdentitySchema = z.object({ secretKey: z.string().regex(/^[0-9a-f]{64}$/) })

/**
 * The long-term Noise static key pair of a direct transport, generated on first use. Its public key is what the
 * other end pins when pairing, so it is kept for the lifetime of the transport.
 */
export function loadOrCreateDirectIdentity(storage: LinkTransportStorage): NoiseKeyPair {
	const stored = StoredIdentitySchema.safeParse(storage.get(STORAGE_KEY))
	if (stored.success) return generateKeyPair(Buffer.from(stored.data.secretKey, 'hex'))

	const keyPair = generateKeyPair()
	storage.set(STORAGE_KEY, { secretKey: keyPair.secretKey.toString('hex') })
	return keyPair
}
