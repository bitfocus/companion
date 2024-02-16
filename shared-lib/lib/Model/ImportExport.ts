import type { ExportFormat } from './ExportFormat.js'
import type { UserConfigGridSize } from './UserConfigModel.js'

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

export interface ClientImportSelection {
	buttons: boolean
	customVariables: boolean
	surfaces: boolean
	triggers: boolean
}

export interface ClientPageInfo {
	name: string
	gridSize: UserConfigGridSize
}
export interface ClientImportObject {
	type: 'page' | 'full'
	instances: Record<string, { label: string; instance_type: string; sortOrder?: number }>
	controls: boolean
	customVariables: boolean
	surfaces: boolean
	triggers: boolean | Record<string, { name: string }>
	oldPageNumber?: number
	page?: ClientPageInfo
	pages?: Record<number, ClientPageInfo>
}
