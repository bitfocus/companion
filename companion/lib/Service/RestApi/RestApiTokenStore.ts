import { createHash, timingSafeEqual } from 'node:crypto'
import { nanoid } from 'nanoid'
import type { ApiKeyAudience, ApiKeyInfo, ApiTokenScope } from '@companion-app/shared/Model/ApiKeys.js'
import type { DataStoreTableView } from '../../Data/StoreBase.js'
import type { Logger } from '../../Log/Controller.js'
import type { ApiToken, ApiTokenStore } from './RestApiAuth.js'

/** The audience minted by this store. All keys created here grant access to the v2 REST API. */
const REST_API_AUDIENCE: ApiKeyAudience = 'rest-v2'

/** Human-visible prefix on every generated token, so leaked tokens are recognisable to scanners. */
const TOKEN_PREFIX = 'cpn_'

/** How much of the plaintext token to retain (non-secret) so a key can be identified in the UI. */
const DISPLAY_PREFIX_LENGTH = TOKEN_PREFIX.length + 6

/**
 * The record persisted for each API key. The token itself is never stored - only its SHA-256 hash
 * and a short non-secret display prefix.
 */
interface StoredApiKey {
	id: string
	name: string
	api: ApiKeyAudience
	scopes: ApiTokenScope[]
	tokenHash: string
	tokenPrefix: string
	createdAt: number
	lastUsedAt: number | null
}

type ApiKeyTable = Record<string, StoredApiKey>

/** SHA-256 hex digest of a plaintext token. Deterministic, so tokens can be matched by hash. */
function hashToken(plaintext: string): string {
	return createHash('sha256').update(plaintext).digest('hex')
}

/**
 * Persistent, hashed store of REST API keys, backed by the `api_keys` SQLite table.
 *
 * Tokens are high-entropy random strings, so they are stored as a fast SHA-256 hash rather than a
 * slow password hash (bcrypt/argon2): there is no dictionary/brute-force surface to defend against,
 * and a deterministic hash lets a presented token be matched without a per-record salted comparison.
 * The plaintext is returned exactly once, at creation.
 */
export class RestApiTokenStore implements ApiTokenStore {
	readonly #logger: Logger
	readonly #table: DataStoreTableView<ApiKeyTable>

	constructor(logger: Logger, table: DataStoreTableView<ApiKeyTable>) {
		this.#logger = logger
		this.#table = table
	}

	/**
	 * Look up a key by its plaintext token. Hashes the input and compares (constant-time) against the
	 * stored hashes; rejects any key whose audience is not this API. Records the time of use.
	 */
	findByToken(plaintext: string): ApiToken | undefined {
		if (!plaintext) return undefined

		const presentedHash = Buffer.from(hashToken(plaintext), 'hex')

		for (const record of Object.values(this.#table.all())) {
			if (record.api !== REST_API_AUDIENCE) continue

			const storedHash = Buffer.from(record.tokenHash, 'hex')
			if (storedHash.length !== presentedHash.length || !timingSafeEqual(storedHash, presentedHash)) continue

			// Best-effort record of last use; never blocks or fails auth.
			this.#table.set(record.id, { ...record, lastUsedAt: Date.now() })

			return { id: record.id, name: record.name, scopes: record.scopes }
		}

		return undefined
	}

	/** All keys as public metadata, ordered oldest-first. Never exposes the token or its hash. */
	list(): ApiKeyInfo[] {
		return Object.values(this.#table.all())
			.map(toApiKeyInfo)
			.sort((a, b) => a.createdAt - b.createdAt)
	}

	/**
	 * Create a new key. Returns the plaintext token exactly once - it cannot be recovered afterwards -
	 * alongside the stored metadata.
	 */
	create(name: string, scopes: ApiTokenScope[]): { info: ApiKeyInfo; token: string } {
		const id = nanoid()
		const token = TOKEN_PREFIX + nanoid(40)

		const record: StoredApiKey = {
			id,
			name,
			api: REST_API_AUDIENCE,
			scopes,
			tokenHash: hashToken(token),
			tokenPrefix: token.slice(0, DISPLAY_PREFIX_LENGTH),
			createdAt: Date.now(),
			lastUsedAt: null,
		}

		this.#table.set(id, record)
		this.#logger.info(`Created API key "${name}" (${id}) with scopes: ${scopes.join(', ') || 'none'}`)

		return { info: toApiKeyInfo(record), token }
	}

	/**
	 * Update a key's name and scopes. The token itself is never changed. Returns the updated metadata,
	 * or undefined if no key with that id exists.
	 */
	update(id: string, changes: { name: string; scopes: ApiTokenScope[] }): ApiKeyInfo | undefined {
		const existing = this.#table.get(id)
		if (!existing) return undefined

		const updated: StoredApiKey = { ...existing, name: changes.name, scopes: changes.scopes }
		this.#table.set(id, updated)
		this.#logger.info(`Updated API key "${changes.name}" (${id}) scopes: ${changes.scopes.join(', ') || 'none'}`)

		return toApiKeyInfo(updated)
	}

	/** Revoke a key by id. Returns whether a key was removed. */
	delete(id: string): boolean {
		const existing = this.#table.get(id)
		if (!existing) return false

		this.#table.delete(id)
		this.#logger.info(`Revoked API key "${existing.name}" (${id})`)
		return true
	}
}

/** Strip the secret fields, leaving only metadata safe to expose. */
function toApiKeyInfo(record: StoredApiKey): ApiKeyInfo {
	return {
		id: record.id,
		name: record.name,
		api: record.api,
		scopes: record.scopes,
		tokenPrefix: record.tokenPrefix,
		createdAt: record.createdAt,
		lastUsedAt: record.lastUsedAt,
	}
}
