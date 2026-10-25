import z from 'zod'
import { createCollectionSchema, EmptyCollectionDataSchema, EnabledCollectionDataSchema } from '../Collections.js'
import { CustomVariableDefinitionSchema } from '../CustomVariableModel.js'
import { ExpressionVariableModelSchema } from '../ExpressionVariableModel.js'
import { ImageLibraryInfoSchema } from '../ImageLibraryModel.js'
import { InstanceVersionUpdatePolicy, ModuleInstanceType } from '../Instance.js'
import {
	OutboundSurfaceInfoSchema,
	SurfaceConfigSchema,
	SurfaceGroupConfigSchema,
	SurfacePanelConfigSchema,
} from '../Surfaces.js'
import { undescribed } from './Undescribed.js'
import { withoutDefaults } from './WithoutDefaults.js'

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
const ExportV17EnabledCollectionsSchema = z.array(createCollectionSchema(EnabledCollectionDataSchema))
const ExportV17EmptyCollectionsSchema = z.array(createCollectionSchema(EmptyCollectionDataSchema))
/** An image of the library. One that is invalid is skipped, rather than failing the import */
const ExportV17ImageSchema = z
	.object({
		info: ImageLibraryInfoSchema,
		/** A base64 data url */
		originalImage: z.string(),
		/** A base64 data url */
		previewImage: z.string(),
	})
	.optional()
	.catch(undefined)
const ExportV17ImageLibrarySchema = z.array(ExportV17ImageSchema)

/** The config of a surface group. The import applies it field by field, over any existing group */
const ExportV17SurfaceGroupConfigSchema = withoutDefaults(SurfaceGroupConfigSchema)

/** A surface. Its group config is only used when it is in its own automatic group */
const ExportV17SurfaceSchema = withoutDefaults(SurfaceConfigSchema.out).extend({
	config: withoutDefaults(SurfacePanelConfigSchema).catchall(z.any()).optional(),
	groupConfig: ExportV17SurfaceGroupConfigSchema.optional(),
})

/** A remote surface. One that is invalid is skipped, rather than failing the import */
const ExportV17RemoteSurfaceSchema = OutboundSurfaceInfoSchema.optional().catch(undefined)

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
	triggerCollections: ExportV17EnabledCollectionsSchema.optional(),
	custom_variables: z.record(z.string(), CustomVariableDefinitionSchema).optional(),
	customVariablesCollections: ExportV17EmptyCollectionsSchema.optional(),
	expressionVariables: z.record(z.string(), ExpressionVariableModelSchema).optional(),
	expressionVariablesCollections: ExportV17EmptyCollectionsSchema.optional(),
	instances: ExportV17InstancesSchema.optional(),
	connectionCollections: ExportV17EnabledCollectionsSchema.optional(),
	surfaces: z.record(z.string(), ExportV17SurfaceSchema).optional(),
	surfaceGroups: z.record(z.string(), ExportV17SurfaceGroupConfigSchema).optional(),
	surfacesRemote: z.record(z.string(), ExportV17RemoteSurfaceSchema).optional(),
	surfaceInstances: ExportV17InstancesSchema.optional(),
	surfaceInstanceCollections: ExportV17EnabledCollectionsSchema.optional(),
	imageLibrary: ExportV17ImageLibrarySchema.optional(),
	imageLibraryCollections: ExportV17EmptyCollectionsSchema.optional(),
})

export const ExportV17PageModelSchema = z.object({
	...exportV17Base,
	type: z.literal('page'),
	page: ExportV17PageContentSchema,
	instances: ExportV17InstancesSchema.optional(),
	connectionCollections: ExportV17EnabledCollectionsSchema.optional(),
	/** The number of the page it was exported from */
	oldPageNumber: z.number().optional(),
	imageLibrary: ExportV17ImageLibrarySchema.optional(),
	imageLibraryCollections: ExportV17EmptyCollectionsSchema.optional(),
})

export const ExportV17TriggersListSchema = z.object({
	...exportV17Base,
	type: z.literal('trigger_list'),
	triggers: z.record(z.string(), ExportV17TriggerContentSchema).default(() => ({})),
	triggerCollections: ExportV17EnabledCollectionsSchema.optional(),
	instances: ExportV17InstancesSchema.optional(),
	connectionCollections: ExportV17EnabledCollectionsSchema.optional(),
	imageLibrary: ExportV17ImageLibrarySchema.optional(),
	imageLibraryCollections: ExportV17EmptyCollectionsSchema.optional(),
})

export const SomeExportV17Schema = z.discriminatedUnion('type', [
	ExportV17FullSchema,
	ExportV17PageModelSchema,
	ExportV17TriggersListSchema,
])
