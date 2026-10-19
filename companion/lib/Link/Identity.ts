import crypto, { type KeyObject } from 'node:crypto'

/** A short, readable form of a Link id, for the user to recognise an installation by */
export function formatLinkIdFingerprint(linkId: string): string {
	return linkId.slice(0, 16).match(/.{4}/g)?.join('-') ?? linkId
}

/**
 * The identity of this installation: an Ed25519 key pair, generated once. Its public key is the Link id, so the id is
 * stable, and transports can prove it: by signing what they send (eg over a broker), or by authenticating with it
 * (eg the handshake of a direct connection).
 */
export class LinkIdentity {
	/** The Link id: the public key, base64url encoded */
	readonly id: string
	/** The raw (32 byte) public key */
	readonly publicKey: Buffer
	readonly #privateKey: KeyObject

	private constructor(privateKey: KeyObject) {
		this.#privateKey = privateKey
		const jwk = crypto.createPublicKey(privateKey).export({ format: 'jwk' })
		if (!jwk.x) throw new Error('Not an Ed25519 key')
		this.id = jwk.x
		this.publicKey = Buffer.from(jwk.x, 'base64url')
	}

	static generate(): LinkIdentity {
		return new LinkIdentity(crypto.generateKeyPairSync('ed25519').privateKey)
	}

	/** Load an identity saved with {@link toStored}, or null if it is not valid */
	static fromStored(stored: string): LinkIdentity | null {
		try {
			const privateKey = crypto.createPrivateKey({ key: Buffer.from(stored, 'base64'), format: 'der', type: 'pkcs8' })
			return privateKey.asymmetricKeyType === 'ed25519' ? new LinkIdentity(privateKey) : null
		} catch {
			return null
		}
	}

	toStored(): string {
		return this.#privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64')
	}

	/**
	 * Sign some data, for a purpose. The purpose is signed too, so that a signature made for one purpose is never valid
	 * for another, eg a transport's envelope can't be passed off as the key of a handshake
	 * @param context - what the signature is for, eg `companion-link secure-channel static-key`
	 */
	sign(context: string, data: Uint8Array): Buffer {
		return crypto.sign(null, signedMessage(context, data), this.#privateKey)
	}

	/**
	 * The secret key in the (64 byte) form libsodium uses: the seed followed by the public key. For transports that
	 * derive other keys from the identity (eg a Noise static key)
	 */
	get ed25519SecretKey(): Buffer {
		const jwk = this.#privateKey.export({ format: 'jwk' })
		if (!jwk.d) throw new Error('Not an Ed25519 key')
		return Buffer.concat([Buffer.from(jwk.d, 'base64url'), this.publicKey])
	}

	/** The raw public key a Link id stands for, or null if it is not a valid id */
	static publicKeyOf(id: string): Buffer | null {
		const publicKey = Buffer.from(id, 'base64url')
		return publicKey.length === 32 && publicKey.toString('base64url') === id ? publicKey : null
	}

	/** Whether a signature was made by the installation with a Link id, for a purpose (see sign) */
	static verify(id: string, context: string, data: Uint8Array, signature: Uint8Array): boolean {
		if (!LinkIdentity.publicKeyOf(id)) return false
		try {
			const publicKey = crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: id }, format: 'jwk' })
			return crypto.verify(null, signedMessage(context, data), publicKey, signature)
		} catch {
			return false
		}
	}
}

/** What is signed: the purpose, then a separator no purpose contains, then the data */
function signedMessage(context: string, data: Uint8Array): Buffer {
	return Buffer.concat([Buffer.from(context, 'utf8'), Buffer.from([0]), data])
}
