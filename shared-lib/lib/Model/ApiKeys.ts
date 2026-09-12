/**
 * The audience of an API key: which API surface it grants access to. Stored on each key so a key
 * minted for one API can never be accepted by a future, different one.
 */
export type ApiKeyAudience = 'rest-v2'

/**
 * A capability an API key can be granted. `admin` implies every scope; `write` and `execute` each
 * imply `read`.
 */
export const API_KEY_SCOPES = ['read', 'write', 'execute', 'connections', 'admin'] as const
export type ApiTokenScope = (typeof API_KEY_SCOPES)[number]

/**
 * Public metadata for an API key, safe to expose to the UI. Never contains the token or its hash -
 * only a short non-secret prefix so a key can be recognised after creation.
 */
export interface ApiKeyInfo {
	id: string
	name: string
	api: ApiKeyAudience
	scopes: ApiTokenScope[]
	tokenPrefix: string
	createdAt: number
	lastUsedAt: number | null
}
