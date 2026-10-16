// Minimal types for the parts of noise-handshake used by the direct Link transport

declare module 'noise-handshake' {
	export interface NoiseKeyPair {
		publicKey: Buffer
		secretKey: Buffer
	}

	export default class Noise {
		constructor(pattern: 'XX' | 'IK' | 'NN' | 'XK', initiator: boolean, staticKeypair?: NoiseKeyPair)

		readonly s: NoiseKeyPair
		readonly complete: boolean
		/** Key for sending, once complete */
		readonly tx: Buffer | null
		/** Key for receiving, once complete */
		readonly rx: Buffer | null
		/** The remote static public key, once received */
		readonly rs: Buffer | null
		/** Hash of the whole handshake, once complete. Identical on both sides */
		readonly hash: Buffer | null

		initialise(prologue: Buffer, remoteStatic?: Buffer): void
		send(payload?: Buffer): Buffer
		recv(buf: Buffer): Buffer
	}
}

declare module 'noise-handshake/cipher' {
	export default class CipherState {
		constructor(key: Buffer)
		encrypt(plaintext: Buffer, ad?: Buffer): Buffer
		decrypt(ciphertext: Buffer, ad?: Buffer): Buffer
	}
}

declare module 'noise-handshake/dh' {
	import type { NoiseKeyPair } from 'noise-handshake'

	export function generateKeyPair(privKey?: Buffer): NoiseKeyPair
}
