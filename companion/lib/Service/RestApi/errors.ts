/**
 * Custom error class for REST API errors with HTTP status codes and error codes.
 */
export class RestApiError extends Error {
	readonly statusCode: number
	readonly code: string
	readonly details?: unknown

	constructor(statusCode: number, code: string, message: string, details?: unknown) {
		super(message)
		this.name = 'RestApiError'
		this.statusCode = statusCode
		this.code = code
		this.details = details
	}

	static notFound(message = 'Resource not found'): RestApiError {
		return new RestApiError(404, 'NOT_FOUND', message)
	}

	static badRequest(message: string, details?: unknown): RestApiError {
		return new RestApiError(400, 'BAD_REQUEST', message, details)
	}

	static conflict(message: string): RestApiError {
		return new RestApiError(409, 'CONFLICT', message)
	}

	static forbidden(message = 'Forbidden'): RestApiError {
		return new RestApiError(403, 'FORBIDDEN', message)
	}

	static unauthorized(message = 'Unauthorized'): RestApiError {
		return new RestApiError(401, 'UNAUTHORIZED', message)
	}

	static unprocessable(message: string, details?: unknown): RestApiError {
		return new RestApiError(422, 'UNPROCESSABLE_ENTITY', message, details)
	}
}
