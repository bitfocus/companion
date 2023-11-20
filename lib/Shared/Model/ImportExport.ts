import type { ExportFormat } from './ExportFormat.js'

export interface ClientResetSelection {
	buttons: boolean
	connections: boolean
	surfaces: boolean
	triggers: boolean
	customVariables: boolean
	userconfig: boolean
}

export interface ClientExportSelection {
	buttons: boolean
	triggers: boolean
	customVariables: boolean
	connections: boolean
	surfaces: boolean

	format: ExportFormat
}
