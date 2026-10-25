import type z from 'zod'
import {
	EXPORT_V17,
	SomeExportV17Schema,
	type ExportV17FullSchema,
	type ExportV17PageContentSchema,
	type ExportV17PageModelSchema,
	type ExportV17TriggersListSchema,
} from './ExportV17.js'

// The latest version of the export format. A new version repoints these, and SomeExportSchema becomes a
// discriminated union on `version` of the new version's schema and the previous one with a transform migrating it

/** The version exports are made with */
export const EXPORT_VERSION = EXPORT_V17

/**
 * The exact schema of each version of the export format. Once released, a version may only change compatibly, which
 * a snapshot test checks
 */
export const ExportSchemaByVersion: Record<number, z.ZodType> = {
	[EXPORT_V17]: SomeExportV17Schema,
}

/** Parses an export of any version described by a schema, giving the latest version */
export const SomeExportSchema = SomeExportV17Schema
export type SomeExport = z.output<typeof SomeExportSchema>

export type ExportFull = z.output<typeof ExportV17FullSchema>
export type ExportPageModel = z.output<typeof ExportV17PageModelSchema>
export type ExportTriggersList = z.output<typeof ExportV17TriggersListSchema>
export type ExportPageContent = z.output<typeof ExportV17PageContentSchema>
export type ExportControl = ExportPageContent['controls'][number][number]
export type ExportTriggerContent = NonNullable<ExportFull['triggers']>[string]
export type ExportInstances = NonNullable<ExportFull['instances']>
