import { createHash, timingSafeEqual } from 'node:crypto'
import { nanoid } from 'nanoid'
import z from 'zod'
import {
	API_KEY_SCOPES,
	type ApiKeyAudience,
	type ApiKeyInfo,
	type ApiTokenScope,
} from '@companion-app/shared/Model/ApiKeys.js'
import type { DataDatabase } from '../../Data/Database.js'
import type { DataStoreSchemaTableView } from '../../Data/SchemaTableView.js'
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
 * and a short non-secret display prefix. The table is shared by every API audience, so this only
 * describes what all keys have.
 */
const StoredApiKeySchema = z.object({
	id: z.string(),
	name: z.string(),
	api: z.string(),
	scopes: z.array(z.string()),
	tokenHash: z.string(),
	tokenPrefix: z.string(),
	createdAt: z.number(),
	lastUsedAt: z.number().nullable().default(null),
})

/** A key minted by this store. One that doesn't match can never be used */
const RestApiKeySchema = StoredApiKeySchema.extend({
	api: z.literal(REST_API_AUDIENCE),
	scopes: z.array(z.enum(API_KEY_SCOPES)),
	tokenHash: z.string().regex(/^[0-9a-f]{64}$/),
})

type RestApiKey = z.output<typeof RestApiKeySchema>

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
	readonly #table: DataStoreSchemaTableView<typeof StoredApiKeySchema>
	/** Invalid keys already warned about, as every request checks every key */
	readonly #warnedInvalidKeyIds = new Set<string>()

	constructor(logger: Logger, db: DataDatabase) {
		this.#logger = logger
		this.#table = db.getSchemaTableView('api_keys', StoredApiKeySchema)
	}

	/** Parse a stored key as one of this API's keys, if it is one */
	#asRestApiKey(record: z.output<typeof StoredApiKeySchema> | undefined): RestApiKey | undefined {
		if (!record || record.api !== REST_API_AUDIENCE) return undefined

		const result = RestApiKeySchema.safeParse(record)
		if (!result.success) {
			if (!this.#warnedInvalidKeyIds.has(record.id)) {
				this.#warnedInvalidKeyIds.add(record.id)
				this.#logger.warn(`Ignoring invalid API key "${record.id}": ${z.prettifyError(result.error)}`)
			}
			return undefined
		}
		return result.data
	}

	#allRestApiKeys(): RestApiKey[] {
		return Object.values(this.#table.all())
			.map((record) => this.#asRestApiKey(record))
			.filter((key) => key !== undefined)
	}

	/**
	 * Look up a key by its plaintext token. Hashes the input and compares (constant-time) against the
	 * stored hashes; rejects any key whose audience is not this API. Records the time of use.
	 */
	findByToken(plaintext: string): ApiToken | undefined {
		if (!plaintext) return undefined

		const presentedHash = Buffer.from(hashToken(plaintext), 'hex')

		for (const record of this.#allRestApiKeys()) {
			const storedHash = Buffer.from(record.tokenHash, 'hex')
			if (storedHash.length !== presentedHash.length || !timingSafeEqual(storedHash, presentedHash)) continue

			// Best-effort record of last use; never blocks or fails auth.
			this.#table.set(record.id, { ...record, lastUsedAt: Date.now() })

			return { id: record.id, name: record.name, scopes: record.scopes }
		}

		return undefined
	}

	/**
	 * All keys for this API as public metadata, ordered oldest-first. Never exposes the token or its
	 * hash. Keys minted for another API audience are excluded - the shared table may hold them.
	 */
	list(): ApiKeyInfo[] {
		return this.#allRestApiKeys()
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

		const record: RestApiKey = {
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
		const existing = this.#asRestApiKey(this.#table.get(id))
		if (!existing) return undefined

		const updated: RestApiKey = { ...existing, name: changes.name, scopes: changes.scopes }
		this.#table.set(id, updated)
		this.#logger.info(`Updated API key "${changes.name}" (${id}) scopes: ${changes.scopes.join(', ') || 'none'}`)

		return toApiKeyInfo(updated)
	}

	/** Revoke a key by id. Returns whether a key was removed. */
	delete(id: string): boolean {
		const existing = this.#asRestApiKey(this.#table.get(id))
		if (!existing) return false

		this.#table.delete(id)
		this.#logger.info(`Revoked API key "${existing.name}" (${id})`)
		return true
	}
}

/** Strip the secret fields, leaving only metadata safe to expose. */
function toApiKeyInfo(record: RestApiKey): ApiKeyInfo {
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
