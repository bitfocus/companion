export interface CompanionHTTPRequest {
	baseUrl: string
	body?: string
	headers: Record<string, string>
	hostname: string
	ip: string
	method: string
	originalUrl: string
	path: string
	query: Record<string, string>
}

export interface CompanionHTTPResponse {
	status?: number
	headers?: Record<string, any>
	body?: string
}
