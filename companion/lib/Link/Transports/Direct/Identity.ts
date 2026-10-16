import { generateKeyPair, type KeyPair as NoiseKeyPair } from 'noise-handshake/dh.js'
import { z } from 'zod'
import type { LinkTransportStorage } from '../Types.js'

const STORAGE_KEY = 'identity'
const StoredIdentitySchema = z.object({ secretKey: z.string().regex(/^[0-9a-f]{64}$/) })

/**
 * The Noise static key pair of a direct transport, generated on first use. It isn't what identifies this installation:
 * every handshake proves the key belongs to the installation's Link identity, which is what the other end pins.
 */
export function loadOrCreateNoiseKeyPair(storage: LinkTransportStorage): NoiseKeyPair {
	const stored = StoredIdentitySchema.safeParse(storage.get(STORAGE_KEY))
	if (stored.success) return generateKeyPair(Buffer.from(stored.data.secretKey, 'hex'))

	const keyPair = generateKeyPair()
	storage.set(STORAGE_KEY, { secretKey: Buffer.from(keyPair.secretKey).toString('hex') })
	return keyPair
}
