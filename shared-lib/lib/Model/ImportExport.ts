import z from 'zod'
import { zodExportFormat } from './ExportFormat.js'
import type { UserConfigGridSize } from './UserConfigModel.js'

export const zodClientResetSelection = z.object({
	buttons: z.boolean(),
	connections: z.boolean(),
	surfaces: z.boolean(),
	triggers: z.boolean(),
	customVariables: z.boolean(),
	expressionVariables: z.boolean(),
	userconfig: z.boolean(),
})

export type ClientResetSelection = z.infer<typeof zodClientResetSelection>

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

export const zodClientImportSelection = z.object({
	buttons: z.boolean(),
	surfaces: z.boolean(),
	triggers: z.boolean(),
	customVariables: z.boolean(),
	expressionVariables: z.boolean(),
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
