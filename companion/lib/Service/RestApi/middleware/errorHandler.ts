import type Express from 'express'
import { RestApiError } from '../errors.js'

/**
 * Global error handler for the REST API.
 * Converts RestApiError instances to structured JSON responses.
 */
export function restApiErrorHandler(
	err: Error,
	_req: Express.Request,
	res: Express.Response,
	_next: Express.NextFunction
): void {
	// body-parser rejects bodies over the route's limit before the handler runs
	if (isBodyParserError(err) && err.type === 'entity.too.large') {
		err = RestApiError.payloadTooLarge()
	}

	if (err instanceof RestApiError) {
		res.status(err.statusCode).json({
			error: {
				code: err.code,
				message: err.message,
				...(err.details !== undefined ? { details: err.details } : {}),
			},
		})
		return
	}

	// Unknown errors
	res.status(500).json({
		error: {
			code: 'INTERNAL_ERROR',
			message: 'An unexpected error occurred',
		},
	})
}

function isBodyParserError(err: Error): err is Error & { type: string } {
	return 'type' in err && typeof err.type === 'string'
}
