/**
 * Error interceptor for the generated OpenAPI clients.
 * The clients report every failure as `error`, including transport failures (network errors, aborts and timeouts)
 * which have no response. Rethrow those, so that callers can tell them apart from an error response from the server.
 */
export function throwTransportErrors<TError>(error: TError, response: Response | undefined): TError {
	if (!response) throw error instanceof Error ? error : new Error(String(error))
	return error
}
