import type { CompanionOptionValues } from '@companion-module/host'

export interface EventInstance {
	id: string
	type: string
	enabled: boolean
	headline?: string
	options: CompanionOptionValues
}
