import z from 'zod'
import { zodExportFormat } from './ExportFormat.js'
import type { UserConfigGridSize } from './UserConfigModel.js'

export const zodImportOrResetType = z.enum(['unchanged', 'reset-and-import', 'reset'])
export type ImportOrResetType = z.infer<typeof zodImportOrResetType>

export const zodResetType = z.enum(['unchanged', 'reset'])
export type ResetType = z.infer<typeof zodResetType>

export const zodClientImportOrResetSelection = z.object({
	buttons: zodImportOrResetType,
	surfaces: z.object({
		known: zodImportOrResetType,
	}),
	triggers: zodImportOrResetType,
	customVariables: zodImportOrResetType,
	expressionVariables: zodImportOrResetType,
	connections: zodResetType,
	userconfig: zodResetType,
})

export type ClientImportOrResetSelection = z.infer<typeof zodClientImportOrResetSelection>

// export const zodClientResetSelection = zodClientImportOrResetSelection.extend({})

// export type ClientResetSelection = z.infer<typeof zodClientResetSelection>

const zodQueryBoolean = z.preprocess((val) => {
	if (typeof val === 'string') {
		return val === 'true' || val === '1'
	}
	return val
}, z.boolean())

export const zodClientExportSelection = z.object({
	buttons: zodQueryBoolean,
	connections: zodQueryBoolean,
	surfaces: zodQueryBoolean,
	triggers: zodQueryBoolean,
	customVariables: zodQueryBoolean,
	expressionVariables: zodQueryBoolean,
	includeSecrets: zodQueryBoolean,
	format: zodExportFormat,
	filename: z.string().optional(),
})

export type ClientExportSelection = z.infer<typeof zodClientExportSelection>

export interface ClientPageInfo {
	name: string
	gridSize: UserConfigGridSize
}
export interface ClientImportObjectInstance {
	label: string
	moduleId: string
	moduleVersionId: string | null
	sortOrder?: number
}
export interface ClientImportObject {
	type: 'page' | 'full'
	connections: Record<string, ClientImportObjectInstance>
	buttons: boolean
	surfaces: boolean
	triggers: boolean | Record<string, { name: string }>
	customVariables: boolean
	expressionVariables: boolean
	oldPageNumber?: number
	page?: ClientPageInfo
	pages?: Record<number, ClientPageInfo>
}

/** Remap old connection IDs to new IDs */
export type ConnectionRemappings = Record<string, string | undefined>
