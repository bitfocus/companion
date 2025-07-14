import z from 'zod'
import type { ExportFormat } from './ExportFormat.js'
import type { UserConfigGridSize } from './UserConfigModel.js'

export const zodClientResetSelection = z.object({
	buttons: z.boolean(),
	connections: z.boolean(),
	surfaces: z.boolean(),
	triggers: z.boolean(),
	customVariables: z.boolean(),
	userconfig: z.boolean(),
	imageLibrary: z.boolean(),
})

export type ClientResetSelection = z.infer<typeof zodClientResetSelection>

export interface ClientExportSelection {
	buttons: boolean
	triggers: boolean
	customVariables: boolean
	connections: boolean
	surfaces: boolean
	imageLibrary: boolean
	format: ExportFormat
	filename?: string
}

export const zodClientImportSelection = z.object({
	buttons: z.boolean(),
	surfaces: z.boolean(),
	triggers: z.boolean(),
	customVariables: z.boolean(),
	imageLibrary: z.boolean(),
})

export type ClientImportSelection = z.infer<typeof zodClientImportSelection>

export interface ClientPageInfo {
	name: string
	gridSize: UserConfigGridSize
}
export interface ClientImportObjectInstance {
	label: string
	instance_type: string
	moduleVersionId: string | null
	sortOrder?: number
}
export interface ClientImportObject {
	type: 'page' | 'full'
	instances: Record<string, ClientImportObjectInstance>
	controls: boolean
	customVariables: boolean
	surfaces: boolean
	triggers: boolean | Record<string, { name: string }>
	imageLibrary: boolean
	oldPageNumber?: number
	page?: ClientPageInfo
	pages?: Record<number, ClientPageInfo>
}

export type ConnectionRemappings = Record<string, string | undefined>
