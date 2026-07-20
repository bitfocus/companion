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
	cpn_connections_read: {
		id: 'static-connections-read',
		name: 'Dev Connections Read Token',
		token: 'cpn_connections_read',
		scopes: ['connections', 'read'],
	},
	cpn_connections_write: {
		id: 'static-connections-write',
		name: 'Dev Connections Write Token',
		token: 'cpn_connections_write',
		scopes: ['connections', 'read', 'write'],
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
