import type { Operation as JsonPatchOperation } from 'fast-json-patch'
import z from 'zod'
import {
	surfaceAppearanceSchema,
	surfaceLayoutSchema,
	type SurfaceAppearanceDefinition,
	type SurfaceSchemaBitmapConfig,
	type SurfaceSchemaControlDefinition,
	type SurfaceSchemaControlStylePreset,
	type SurfaceSchemaLayoutDefinition,
	type SurfaceSchemaLedsConfig,
} from '@companion-surface/base'
import type { CollectionBase, EnabledCollectionData } from './Collections.js'
import type { DropdownChoice } from './Common.js'
import type {
	CompanionInputFieldCheckboxExtended,
	CompanionInputFieldCustomVariableExtended,
	CompanionInputFieldDropdownExtended,
	CompanionInputFieldExpressionExtended,
	CompanionInputFieldNumberExtended,
	CompanionInputFieldStaticTextExtended,
	CompanionInputFieldTextInputExtended,
} from './Options.js'

/**
 * The surface layout schema is owned by the surface api package, which both the plugin and satellite surfaces
 * describe their layouts with. Re-exported here so that consumers of the models below get the same types from
 * the same place, rather than a second description of the same thing.
 */
export type {
	SurfaceAppearanceDefinition,
	SurfaceSchemaBitmapConfig,
	SurfaceSchemaControlDefinition,
	SurfaceSchemaControlStylePreset,
	SurfaceSchemaLayoutDefinition,
	SurfaceSchemaLedsConfig,
}

export type GridSize = { columns: number; rows: number }
export const SurfaceRotationSchema = z.literal(['surface90', 'surface-90', 'surface180', 'surface0', 0, -90, 90, 180])

export type SurfaceRotation = z.output<typeof SurfaceRotationSchema>

export interface RowsAndColumns {
	rows: number
	columns: number
}

export interface SurfaceFirmwareUpdateInfo {
	updaterDownloadUrl: string
}

/**
 * Pixel dimensions of the bitmap a surface control is drawn at, without the pixel format which is only of
 * interest to whatever is doing the drawing.
 */
export type SurfaceLayoutBitmapSize = Pick<SurfaceSchemaBitmapConfig, 'w' | 'h'>

/**
 * The full layout manifest of a surface, as pushed to the client.
 */
export interface ClientSurfaceLayoutItem {
	id: string
	/** The model name of the surface, matching `ClientSurfaceItem.type` */
	type: string
	/** Which kind of surface integration this came from, matching `ClientSurfaceItem.integrationType` */
	integrationType: string
	displayName: string
	isConnected: boolean
	layout: SurfaceSchemaLayoutDefinition
	/** How to draw the surface's face; null when it supplied none and the face is derived from the layout */
	appearance: SurfaceAppearanceDefinition | null
	/** Which declared model the surface is, qualified as `ClientSurfaceModelItem.id` is; null when it named none */
	modelId: string | null
}

/**
 * A model of surface a plugin knows how to drive, as pushed to the client.
 *
 * Declared by the plugin rather than learned from a device, so these exist for surfaces nobody here
 * has ever owned - which is the point of them. A model is only a description of a shape: it has no
 * place on the grid and no config, because there is nothing of it here to place or configure.
 */
export interface ClientSurfaceModelItem {
	/** Unique across Companion: the plugin's own model id, qualified by the module which declared it */
	id: string
	/** The surface module which declared this model */
	moduleId: string
	/**
	 * User facing name of the model, eg `Stream Deck XL`. Matches `ClientSurfaceItem.type` for a surface of it,
	 * unless another module declared a model of the same name, in which case it is suffixed with the declaring
	 * module to keep the two apart.
	 */
	name: string
	/** The controls this model has, in the form a connected surface of it would report */
	layout: SurfaceSchemaLayoutDefinition
	/** How to draw the model's face, if it declared a valid one; drawn from the layout's geometry otherwise */
	appearance: SurfaceAppearanceDefinition | undefined
}

/**
 * The button sizes of a surface, as pushed to the client. A summary of `ClientSurfaceLayoutItem` for consumers
 * which only care about how large the buttons are, and shouldn't have to receive every control to find out.
 */
export interface ClientSurfaceButtonSizesItem {
	id: string
	/** The model name of the surface, matching `ClientSurfaceItem.type` */
	type: string
	displayName: string
	isConnected: boolean
	/** The distinct sizes this surface's controls are drawn at */
	bitmapSizes: SurfaceLayoutBitmapSize[]
}

export interface ClientSurfaceItem {
	id: string
	type: string
	integrationType: string
	name: string
	configFields: CompanionSurfaceConfigField[]
	isConnected: boolean
	displayName: string
	location: string | null
	locked: boolean

	/**
	 * Whether this surface is enabled and should be opened when discovered.
	 * Note: This setting does not apply to satellite, emulator, or elgato-plugin surfaces.
	 */
	enabled: boolean

	/**
	 * Whether the enabled setting can be changed for this surface.
	 * Note: A surface can move between connection types, so this is based on the current connection.
	 */
	canChangeEnabled: boolean

	hasFirmwareUpdates: SurfaceFirmwareUpdateInfo | null

	/** When the surface was last connected, as a unix timestamp in ms; null if that was never recorded */
	lastSeen: number | null

	size: RowsAndColumns | null
	rotation: SurfaceRotation | null
	brightness: number | null
	offset: RowsAndColumns | null
}

export interface ClientDevicesListItem {
	id: string
	index: number | null
	displayName: string
	isAutoGroup: boolean
	surfaces: ClientSurfaceItem[]
}

export const SurfaceGroupConfigSchema = z.object({
	name: z.string().default('Unnamed group'),
	last_page_id: z.string().default(''),
	startup_page_id: z.string().default(''),
	use_last_page: z.boolean().default(true),
	never_lock: z.boolean().default(false),
	restrict_pages: z.boolean().default(false),
	allowed_page_ids: z.array(z.string()).default(() => []),

	/** @deprecated. replaced by last_page_id but still used for export */
	last_page: z.number().optional(),
	/** @deprecated. replaced by startup_page_id but still used for export */
	startup_page: z.number().optional(),
	/** @deprecated.  used for export */
	allowed_pages: z.array(z.number()).optional(),
})

export type SurfaceGroupConfig = z.output<typeof SurfaceGroupConfigSchema>

function isObject(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Surfaces saved before groupConfig existed kept their page in their panel config, and at the top level.
 * Build their groupConfig from it, and drop the old fields.
 */
function migrateLegacySurfaceConfig(row: unknown): unknown {
	if (!isObject(row)) return row

	const { page: _legacyPage, ...surface } = row
	const { page, use_last_page, ...panelConfig } = isObject(surface.config) ? surface.config : {}

	return {
		...surface,
		config: panelConfig,
		groupConfig: surface.groupConfig ?? {
			startup_page: page ?? 1,
			use_last_page: use_last_page ?? page === undefined,
		},
	}
}

/**
 * The panel's own properties, and their defaults, are added when it connects; they are kept as they are here
 */
export const SurfacePanelConfigSchema = z
	.object({
		brightness: z.number().default(100),
		rotation: SurfaceRotationSchema.default(0),
		xOffset: z.number().default(0),
		yOffset: z.number().default(0),
		groupId: z.string().nullable().default(null),
	})
	.catchall(z.any())

export type SurfacePanelConfig = z.output<typeof SurfacePanelConfigSchema>

export const SurfaceConfigSchema = z.preprocess(
	migrateLegacySurfaceConfig,
	z.object({
		config: SurfacePanelConfigSchema,
		/** Only used when the surface is in its own automatic group */
		groupConfig: SurfaceGroupConfigSchema.extend({ name: z.string().default('Auto group') }),

		groupId: z.string().nullable().default(null),

		name: z.string().optional(),

		/**
		 * Whether this surface is enabled and should be opened when discovered.
		 * Note: This setting does not apply to satellite, emulator, or elgato-plugin surfaces.
		 */
		enabled: z.boolean().default(true),

		// Properties defined by the panel/integration, that may not be defined for old configs
		type: z.string().optional(),
		integrationType: z.string().optional(),
		gridSize: z.object({ columns: z.number(), rows: z.number() }).optional(),
		/** An invalid layout is dropped, as the surface supplies it again when it connects */
		layout: surfaceLayoutSchema.optional().catch(undefined),
		/**
		 * null when the surface supplied none; undefined for configs saved before this was persisted.
		 * An invalid appearance is dropped, as the surface supplies it again when it connects
		 */
		appearance: surfaceAppearanceSchema.nullable().optional().catch(undefined),
		/**
		 * Which of its module's declared models the surface is, by the id the module declared it with. null when it
		 * named none; undefined for configs saved before this was persisted
		 */
		modelId: z.string().nullable().optional(),
		/**
		 * When the surface was last connected, as a unix timestamp in ms. Stamped on connect and disconnect, so a
		 * surface connected when Companion stopped uncleanly shows when it connected. undefined if never recorded
		 */
		lastSeen: z.number().optional(),
	})
)

export type SurfaceConfig = z.output<typeof SurfaceConfigSchema>

export type SurfacesUpdate =
	SurfacesUpdateInitOp | SurfacesUpdateRemoveOp | SurfacesUpdateAddOp | SurfacesUpdateUpdateOp

export interface SurfacesUpdateInitOp {
	type: 'init'
	info: Record<string, ClientDevicesListItem>
}
export interface SurfacesUpdateRemoveOp {
	type: 'remove'
	itemId: string
}
export interface SurfacesUpdateAddOp {
	type: 'add'
	itemId: string

	info: ClientDevicesListItem
}
export interface SurfacesUpdateUpdateOp {
	type: 'update'
	itemId: string

	patch: JsonPatchOperation<ClientDevicesListItem>[]
}

/**
 * An incremental update to the set of surface models declared to the client, keyed by qualified id.
 */
export type SurfaceModelsUpdate = SurfaceModelsUpdateInitOp | SurfaceModelsUpdateRemoveOp | SurfaceModelsUpdateReplaceOp

export interface SurfaceModelsUpdateInitOp {
	type: 'init'
	models: Record<string, ClientSurfaceModelItem>
}
export interface SurfaceModelsUpdateRemoveOp {
	type: 'remove'
	itemId: string
}
export interface SurfaceModelsUpdateReplaceOp {
	type: 'replace'
	itemId: string

	info: ClientSurfaceModelItem
}

export const OutboundSurfaceInfoSchema = z.object({
	id: z.string(),
	enabled: z.boolean().default(true),

	displayName: z.string().default(''),
	type: z.literal('plugin'),
	moduleId: z.string(),
	instanceId: z.string(),
	config: z.record(z.string(), z.any()).default(() => ({})),

	collectionId: z.string().nullable().default(null),
	sortOrder: z.number().default(0),
})

export type OutboundSurfaceInfo = z.output<typeof OutboundSurfaceInfoSchema>

export type OutboundSurfaceCollectionData = EnabledCollectionData

export type OutboundSurfaceCollection = CollectionBase<OutboundSurfaceCollectionData>

export type OutboundSurfacesUpdate =
	OutboundSurfacesUpdateInitOp | OutboundSurfacesUpdateRemoveOp | OutboundSurfacesUpdateAddOp

export interface OutboundSurfacesUpdateInitOp {
	type: 'init'
	items: Record<string, OutboundSurfaceInfo>
}
export interface OutboundSurfacesUpdateRemoveOp {
	type: 'remove'
	itemId: string
}
export interface OutboundSurfacesUpdateAddOp {
	type: 'add'
	itemId: string

	info: OutboundSurfaceInfo
}

export type ClientDiscoveredSurfaceInfo = ClientDiscoveredSurfaceInfoSatellite | ClientDiscoveredSurfaceInfoPlugin

export interface ClientDiscoveredSurfaceInfoSatellite {
	id: string

	surfaceType: 'satellite'

	name: string
	addresses: string[]
	port: number

	apiEnabled: boolean
}

export interface ClientDiscoveredSurfaceInfoPlugin {
	id: string

	surfaceType: 'plugin'
	instanceId: string

	name: string
	description: string
	address: string | null

	config: Record<string, any>
}

export type SurfacesDiscoveryUpdate =
	SurfaceDiscoveryUpdateInitOp | SurfaceDiscoveryUpdateRemoveOp | SurfaceDiscoveryUpdateUpdateOp

export interface SurfaceDiscoveryUpdateRemoveOp {
	type: 'remove'
	itemId: string
}
export interface SurfaceDiscoveryUpdateUpdateOp {
	type: 'update'
	// itemId: string

	info: ClientDiscoveredSurfaceInfo
}
export interface SurfaceDiscoveryUpdateInitOp {
	type: 'init'
	infos: ClientDiscoveredSurfaceInfo[]
}

export interface CompanionExternalAddresses {
	addresses: DropdownChoice[]
}

export type CompanionSurfaceInputFieldTextInput = Omit<CompanionInputFieldTextInputExtended, 'useVariables'>

export type CompanionSurfaceConfigField =
	| CompanionInputFieldStaticTextExtended
	| CompanionSurfaceInputFieldTextInput
	| CompanionInputFieldExpressionExtended
	| CompanionInputFieldDropdownExtended
	| CompanionInputFieldNumberExtended
	| CompanionInputFieldCheckboxExtended
	| CompanionInputFieldCustomVariableExtended
