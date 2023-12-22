export interface EventInstance {
	id: string
	type: string
	enabled: boolean
	headline?: string
	options: Record<string, any>
}
