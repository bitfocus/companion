import type Express from 'express'
import type { Logger } from '../../Log/Controller.js'
import { RestApiError } from './errors.js'

export type ApiTokenScope = 'read' | 'write' | 'execute' | 'secrets' | 'admin'

export interface ApiToken {
	id: string
	name: string
	token: string
	scopes: ApiTokenScope[]
}

declare global {
	namespace Express {
		interface Request {
			apiToken?: ApiToken
		}
	}
}

/** Maps HTTP method + route semantics to the required scope */
export type RequiredScope = 'read' | 'write' | 'execute' | 'secrets' | 'admin'

/**
 * Check if a token's scopes satisfy the required scope.
 * admin implies all scopes. write and execute each imply read.
 */
export function hasScope(tokenScopes: ApiTokenScope[], required: RequiredScope): boolean {
	if (tokenScopes.includes('admin')) return true
	if (required === 'read') {
		return tokenScopes.includes('read') || tokenScopes.includes('write') || tokenScopes.includes('execute')
	}
	return tokenScopes.includes(required)
}

export interface ApiTokenStore {
	findByToken(plaintext: string): ApiToken | undefined
}

/**
 * Create Bearer token authentication middleware.
 * Extracts token from Authorization header and looks up by plaintext value.
 */
export function createAuthMiddleware(logger: Logger, tokenStore: ApiTokenStore) {
	return (req: Express.Request, _res: Express.Response, next: Express.NextFunction): void => {
		const authHeader = req.headers.authorization
		const match = authHeader?.match(/^Bearer\s+(.+)$/i)
		if (!match) {
			next(RestApiError.unauthorized('Missing or invalid Authorization header'))
			return
		}

		const plainToken = match[1].trim()
		const token = tokenStore.findByToken(plainToken)
		if (!token) {
			next(RestApiError.unauthorized('Invalid API token'))
			return
		}

		// Attach token to request for scope checks
		req.apiToken = token

		logger.debug(`API request authenticated: token="${token.name}" path=${req.path}`)
		next()
	}
}

/**
 * Create scope-checking middleware for a specific required scope.
 */
export function requireScope(scope: RequiredScope) {
	return (req: Express.Request, _res: Express.Response, next: Express.NextFunction): void => {
		const token = req.apiToken
		if (!token) {
			next(RestApiError.unauthorized())
			return
		}

		if (!hasScope(token.scopes, scope)) {
			next(RestApiError.forbidden(`Insufficient scope: requires '${scope}'`))
			return
		}

		next()
	}
}
