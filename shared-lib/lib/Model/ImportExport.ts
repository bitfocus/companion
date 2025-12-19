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
		instances: zodImportOrResetType,
		remote: zodImportOrResetType,
	}),
	triggers: zodImportOrResetType,
	customVariables: zodImportOrResetType,
	expressionVariables: zodImportOrResetType,
	connections: zodResetType, // Future: This should become zodImportOrResetType, once there is a plan for how that should work
	userconfig: zodResetType, // Future: This should become zodImportOrResetType, or more likely an object describing subsections
})

export type ClientImportOrResetSelection = z.infer<typeof zodClientImportOrResetSelection>

const zodQueryBoolean = z.preprocess((val) => {
	if (typeof val === 'string') {
		return val === 'true' || val === '1'
	}
	return val
}, z.boolean())
const zodQueryNull = z.preprocess((val) => {
	if (typeof val === 'string') {
		return val === '' ? null : val
	}
	return val
}, z.null())

export const zodClientExportSelection = z.object({
	buttons: zodQueryBoolean,
	connections: zodQueryBoolean,
	surfaces: z
		.object({
			known: zodQueryBoolean,
			instances: zodQueryBoolean,
			remote: zodQueryBoolean,
		})
		.or(zodQueryNull),
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
	surfacesKnown: boolean
	surfacesInstances: boolean
	surfacesRemote: boolean
	triggers: Record<string, { name: string }> | null
	customVariables: boolean
	expressionVariables: boolean
	oldPageNumber?: number
	page?: ClientPageInfo
	pages?: Record<number, ClientPageInfo>
}

/** Remap old connection IDs to new IDs */
export type ConnectionRemappings = Record<string, string | undefined>
