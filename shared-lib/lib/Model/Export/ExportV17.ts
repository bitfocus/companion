import z from 'zod'
import { InstanceVersionUpdatePolicy, ModuleInstanceType } from '../Instance.js'
import { undescribed } from './Undescribed.js'

// Version 17 of the export format. The first version described by a schema; older exports are upgraded to it by the
// legacy upgrade steps. Once released a version is append-only: it may gain optional properties, but anything else
// needs a new version, with a migration from this one.
// A section may reuse the db schema for it. If that schema changes in a way that isn't an optional addition, this
// version keeps a frozen copy of the old shape, and the new version migrates from it.

export const EXPORT_V17 = 17

// TODO - describe each remaining section
const ExportV17ControlSchema = z.record(z.string(), undescribed())
const ExportV17TriggerContentSchema = z.record(z.string(), undescribed())
/**
 * A connection or surface instance. A page or trigger export has only the minimal fields, without the config, which
 * the import tells apart by whether `config` is present, so the full fields have no defaults
 */
export const ExportV17InstanceSchema = z.object({
	moduleId: z.string(),
	label: z.string(),
	/** -1 runs every upgrade script */
	lastUpgradeIndex: z.number().default(-1),
	moduleVersionId: z.string().nullable().optional(),
	updatePolicy: z.enum(InstanceVersionUpdatePolicy).default(InstanceVersionUpdatePolicy.Stable),
	sortOrder: z.number().optional(),
	collectionId: z.string().optional(),

	// Only in a full export
	moduleInstanceType: z.enum(ModuleInstanceType).optional(),
	config: z.unknown().optional(),
	secrets: z.unknown().optional(),
	isFirstInit: z.boolean().optional(),
	enabled: z.boolean().optional(),
})
const ExportV17InstancesSchema = z.record(z.string(), ExportV17InstanceSchema)
const ExportV17CollectionsSchema = z.array(undescribed())
const ExportV17ImageLibrarySchema = z.array(undescribed())

const ExportV17GridSizeSchema = z.object({
	minColumn: z.number(),
	maxColumn: z.number(),
	minRow: z.number(),
	maxRow: z.number(),
})

export const ExportV17PageContentSchema = z.object({
	id: z.string().optional(),
	name: z.string().default(''),
	/** The controls of the page, by row then column */
	controls: z.record(z.number(), z.record(z.number(), ExportV17ControlSchema)).default(() => ({})),
	/** The page's local variables, the entities of its `page:<id>` control */
	pageVariables: z.array(undescribed()).optional(),
	/** Older exports don't have one, so the smallest grid that fits the controls is used */
	gridSize: ExportV17GridSizeSchema.optional(),
})

const exportV17Base = {
	version: z.literal(EXPORT_V17),
	/** The build of Companion that made the export */
	companionBuild: z.string().optional(),
	/** Free-text notes written by the user when exporting, shown when importing */
	notes: z.string().optional(),
}

export const ExportV17FullSchema = z.object({
	...exportV17Base,
	type: z.literal('full'),
	pages: z.record(z.number(), ExportV17PageContentSchema).optional(),
	triggers: z.record(z.string(), ExportV17TriggerContentSchema).optional(),
	triggerCollections: ExportV17CollectionsSchema.optional(),
	custom_variables: z.record(z.string(), undescribed()).optional(),
	customVariablesCollections: ExportV17CollectionsSchema.optional(),
	expressionVariables: z.record(z.string(), undescribed()).optional(),
	expressionVariablesCollections: ExportV17CollectionsSchema.optional(),
	instances: ExportV17InstancesSchema.optional(),
	connectionCollections: ExportV17CollectionsSchema.optional(),
	surfaces: undescribed().optional(),
	surfaceGroups: undescribed().optional(),
	surfacesRemote: z.record(z.string(), undescribed()).optional(),
	surfaceInstances: ExportV17InstancesSchema.optional(),
	surfaceInstanceCollections: ExportV17CollectionsSchema.optional(),
	imageLibrary: ExportV17ImageLibrarySchema.optional(),
	imageLibraryCollections: ExportV17CollectionsSchema.optional(),
})

export const ExportV17PageModelSchema = z.object({
	...exportV17Base,
	type: z.literal('page'),
	page: ExportV17PageContentSchema,
	instances: ExportV17InstancesSchema.optional(),
	connectionCollections: ExportV17CollectionsSchema.optional(),
	/** The number of the page it was exported from */
	oldPageNumber: z.number().optional(),
	imageLibrary: ExportV17ImageLibrarySchema.optional(),
	imageLibraryCollections: ExportV17CollectionsSchema.optional(),
})

export const ExportV17TriggersListSchema = z.object({
	...exportV17Base,
	type: z.literal('trigger_list'),
	triggers: z.record(z.string(), ExportV17TriggerContentSchema).default(() => ({})),
	triggerCollections: ExportV17CollectionsSchema.optional(),
	instances: ExportV17InstancesSchema.optional(),
	connectionCollections: ExportV17CollectionsSchema.optional(),
	imageLibrary: ExportV17ImageLibrarySchema.optional(),
	imageLibraryCollections: ExportV17CollectionsSchema.optional(),
})

export const SomeExportV17Schema = z.discriminatedUnion('type', [
	ExportV17FullSchema,
	ExportV17PageModelSchema,
	ExportV17TriggersListSchema,
])
