import { X509Certificate } from 'node:crypto'
import selfsigned from 'selfsigned'
import { z } from 'zod'
import type { LinkTransportStorage } from '../Types.js'

export interface DirectServerCertificate {
	cert: string
	key: string
	/** SHA-256 fingerprint, formatted as colon separated hex */
	fingerprint: string
}

const STORAGE_KEY = 'certificate'
const StoredCertificateSchema = z.object({ cert: z.string(), key: z.string() })

/**
 * Load the self-signed certificate of a direct server, generating it on first use.
 * It is kept for the lifetime of the transport, so that clients can pin its fingerprint.
 */
export async function loadOrCreateDirectCertificate(storage: LinkTransportStorage): Promise<DirectServerCertificate> {
	const stored = StoredCertificateSchema.safeParse(storage.get(STORAGE_KEY))
	if (stored.success) {
		return { ...stored.data, fingerprint: getCertificateFingerprint(stored.data.cert) }
	}

	const pems = await selfsigned.generate([{ name: 'commonName', value: 'companion-link' }], {
		notAfterDate: new Date(Date.now() + 20 * 365 * 24 * 60 * 60 * 1000),
		algorithm: 'sha256',
		keySize: 2048,
	})
	storage.set(STORAGE_KEY, { cert: pems.cert, key: pems.private })

	return { cert: pems.cert, key: pems.private, fingerprint: getCertificateFingerprint(pems.cert) }
}

export function getCertificateFingerprint(certPem: string): string {
	return new X509Certificate(certPem).fingerprint256
}

/** Normalise a fingerprint for comparison, so that the user can paste it with or without separators */
export function normaliseFingerprint(fingerprint: string): string {
	return fingerprint.replace(/[^0-9a-f]/gi, '').toUpperCase()
}
