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
	imageLibrary: zodImportOrResetType,
})

export type ClientImportOrResetSelection = z.infer<typeof zodClientImportOrResetSelection>

export const EXPORT_NOTES_MAX_LENGTH = 10000

/** What a custom export includes */
export const zodClientExportSelection = z.object({
	buttons: z.boolean(),
	connections: z.boolean(),
	surfaces: z
		.object({
			known: z.boolean(),
			instances: z.boolean(),
			remote: z.boolean(),
		})
		.nullable(),
	triggers: z.boolean(),
	customVariables: z.boolean(),
	expressionVariables: z.boolean(),
	includeSecrets: z.boolean(),
	imageLibrary: z.boolean(),
})

export type ClientExportSelection = z.infer<typeof zodClientExportSelection>

/** How an export is written out, common to every kind of export */
export const zodClientExportOutput = z.object({
	format: zodExportFormat,
	/** May contain variables. Blank for the generated default */
	filename: z.string(),
	/** Free-text notes saved in the file, shown when importing it. Blank for none */
	notes: z.string().max(EXPORT_NOTES_MAX_LENGTH),
})

export type ClientExportOutput = z.infer<typeof zodClientExportOutput>

/** What to export, for an export started from the UI */
export const zodClientExportTarget = z.discriminatedUnion('type', [
	z.object({ type: z.literal('custom'), selection: zodClientExportSelection }),
	z.object({ type: z.literal('page'), pageNumber: z.number().int(), includeSecrets: z.boolean() }),
	z.object({ type: z.literal('triggers'), includeSecrets: z.boolean() }),
	z.object({ type: z.literal('trigger'), triggerId: z.string(), includeSecrets: z.boolean() }),
])

export type ClientExportTarget = z.infer<typeof zodClientExportTarget>

export const zodClientExportRequest = z.object({
	target: zodClientExportTarget,
	output: zodClientExportOutput,
})

export type ClientExportRequest = z.infer<typeof zodClientExportRequest>

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
	/** The notes written when the file was exported, or null if there are none */
	notes: string | null
	connections: Record<string, ClientImportObjectInstance>
	buttons: boolean
	surfacesKnown: boolean
	surfacesInstances: boolean
	surfacesRemote: boolean
	triggers: Record<string, { name: string }> | null
	customVariables: boolean
	expressionVariables: boolean
	imageLibrary: boolean
	oldPageNumber?: number
	page?: ClientPageInfo
	pages?: Record<number, ClientPageInfo>
}

/** Remap old connection IDs to new IDs */
export type ConnectionRemappings = Record<string, string | undefined>

export type ImportExportTaskType = 'reset' | 'import'

interface ImportExportTaskBase {
	type: ImportExportTaskType
	/** Identifies this specific run; returned by the mutation that started it so a client can track it */
	runId: string
}

export interface ImportExportRunningTask extends ImportExportTaskBase {
	status: 'running'
}

export interface ImportExportCompletedTask extends ImportExportTaskBase {
	status: 'completed'
	/** null on success, otherwise a description of the failure */
	error: string | null
}

/**
 * The current or most-recent import/reset task. A completed task is retained (so a client can observe
 * the outcome of the run it started) until the next task begins, or null if none has ever run.
 */
export type ImportExportTask = ImportExportRunningTask | ImportExportCompletedTask
