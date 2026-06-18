import type { ApiToken, ApiTokenStore } from './RestApiAuth.js'

/**
 * Static development tokens for the REST API prototype.
 */
const STATIC_DEV_TOKENS: Record<string, ApiToken> = {
	cpn_read: {
		id: 'static-read',
		name: 'Dev Read Token',
		token: 'cpn_read',
		scopes: ['read'],
	},
	cpn_write: {
		id: 'static-write',
		name: 'Dev Write Token',
		token: 'cpn_write',
		scopes: ['read', 'write'],
	},
	cpn_secrets: {
		id: 'static-secrets',
		name: 'Dev Secrets Token',
		token: 'cpn_secrets',
		scopes: ['read', 'write', 'secrets'],
	},
	cpn_admin: {
		id: 'static-admin',
		name: 'Dev Admin Token',
		token: 'cpn_admin',
		scopes: ['admin'],
	},
}

/**
 * Minimal token store for the REST API prototype.
 */
export class RestApiTokenStoreMemory implements ApiTokenStore {
	findByToken(plaintext: string): ApiToken | undefined {
		return STATIC_DEV_TOKENS[plaintext]
	}
}
