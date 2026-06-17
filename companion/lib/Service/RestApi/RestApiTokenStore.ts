import { nanoid } from 'nanoid'
import type { ApiToken, ApiTokenScope, ApiTokenStore } from './RestApiAuth.js'
import LogController from '../../Log/Controller.js'

/**
 * Static development tokens for easy testing.
 * These are always available when the REST API is enabled.
 */
const STATIC_DEV_TOKENS: ApiToken[] = [
	{
		id: 'static-read',
		name: 'Dev Read Token',
		token: 'cpn_read',
		scopes: ['read'],
	},
	{
		id: 'static-write',
		name: 'Dev Write Token',
		token: 'cpn_write',
		scopes: ['read', 'write'],
	},
	{
		id: 'static-execute',
		name: 'Dev Execute Token',
		token: 'cpn_execute',
		scopes: ['read', 'execute'],
	},
	{
		id: 'static-secrets',
		name: 'Dev Secrets Token',
		token: 'cpn_secrets',
		scopes: ['read', 'write', 'secrets'],
	},
	{
		id: 'static-admin',
		name: 'Dev Admin Token',
		token: 'cpn_admin',
		scopes: ['admin'],
	},
]

/**
 * In-memory token store for the REST API prototype.
 * Includes static dev tokens (cpn_read, cpn_write, cpn_execute, cpn_admin)
 * for easy testing without needing a token management endpoint.
 */
export class RestApiTokenStoreMemory implements ApiTokenStore {
	readonly #logger = LogController.createLogger('Service/RestApi/TokenStore')
	readonly #tokens: Map<string, ApiToken> = new Map() // keyed by plaintext token

	constructor() {
		// Register static dev tokens
		for (const token of STATIC_DEV_TOKENS) {
			this.#tokens.set(token.token, token)
		}
		this.#logger.info(
			`Token store initialized with ${STATIC_DEV_TOKENS.length} static dev tokens: ${STATIC_DEV_TOKENS.map((t) => t.token).join(', ')}`
		)
	}

	/**
	 * Create a new API token. Returns the token object with its plaintext value.
	 */
	createToken(name: string, scopes: ApiTokenScope[]): { token: ApiToken; plaintext: string } {
		const id = nanoid()
		const plaintext = `cpn_${id}`

		const token: ApiToken = {
			id,
			name,
			token: plaintext,
			scopes,
		}

		this.#tokens.set(plaintext, token)
		this.#logger.info(`Created API token "${name}" (id=${id})`)

		return { token, plaintext }
	}

	/**
	 * Find a token by its plaintext value.
	 */
	findByToken(plaintext: string): ApiToken | undefined {
		return this.#tokens.get(plaintext)
	}

	/**
	 * List all tokens.
	 */
	listTokens(): ApiToken[] {
		return Array.from(this.#tokens.values())
	}

	/**
	 * Delete a token by ID.
	 */
	deleteToken(tokenId: string): boolean {
		for (const [key, token] of this.#tokens.entries()) {
			if (token.id === tokenId) {
				this.#tokens.delete(key)
				this.#logger.info(`Deleted API token "${token.name}" (id=${tokenId})`)
				return true
			}
		}
		return false
	}
}
