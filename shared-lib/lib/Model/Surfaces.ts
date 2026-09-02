import type { Operation as JsonPatchOperation } from 'fast-json-patch'
import type { CollectionBase } from './Collections.js'
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

export type GridSize = { columns: number; rows: number }
export type SurfaceRotation = 'surface90' | 'surface-90' | 'surface180' | 'surface0' | 0 | -90 | 90 | 180

export interface RowsAndColumns {
	rows: number
	columns: number
}

export interface SurfaceFirmwareUpdateInfo {
	updaterDownloadUrl: string
}

/**
 * Pixel dimensions of the bitmap a surface control expects to be drawn at.
 */
export interface SurfaceLayoutBitmapSize {
	w: number
	h: number
}

export interface SurfaceLayoutLedsConfig {
	segments: number
	mode: 'full-ring' | 'simple'
}

/**
 * The styling a surface requests for a control. Mirrors the style presets in the surface layout schemas used
 * by the plugin (`@companion-surface/host`) and satellite APIs, so that a layout from either can be described
 * with these types without depending on those packages.
 */
export interface SurfaceLayoutStylePreset {
	bitmap?: SurfaceLayoutBitmapSize
	text?: boolean
	textStyle?: boolean
	colors?: 'hex' | 'rgb'
	leds?: SurfaceLayoutLedsConfig
}

export interface SurfaceLayoutControl {
	row: number
	column: number
	stylePreset?: string
}

/**
 * The layout manifest a surface reports when it connects: the styles it can draw, and the controls it has.
 */
export interface SurfaceLayoutDefinition {
	stylePresets: Record<string, SurfaceLayoutStylePreset> & { default: SurfaceLayoutStylePreset }
	controls: Record<string, SurfaceLayoutControl>
}

/**
 * The full layout manifest of a surface, as pushed to the client.
 */
export interface ClientSurfaceLayoutItem {
	id: string
	/** The model name of the surface, matching `ClientSurfaceItem.type` */
	type: string
	displayName: string
	isConnected: boolean
	layout: SurfaceLayoutDefinition
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

export interface SurfaceConfig {
	config: SurfacePanelConfig
	groupConfig: SurfaceGroupConfig

	groupId: string | null

	name?: string

	/**
	 * Whether this surface is enabled and should be opened when discovered.
	 * Defaults to true when not specified.
	 * Note: This setting does not apply to satellite, emulator, or elgato-plugin surfaces.
	 */
	enabled?: boolean

	// Properties defined by the panel/integration, that may not be defined for old configs
	type: string | undefined
	integrationType: string | undefined
	gridSize: GridSize | undefined
	layout: SurfaceLayoutDefinition | undefined
}

export interface SurfaceGroupConfig {
	name: string
	last_page_id: string
	startup_page_id: string
	use_last_page: boolean
	never_lock: boolean
	restrict_pages?: boolean
	allowed_page_ids?: string[]

	/** @deprecated. replaced by last_page_id but still used for export */
	last_page?: number
	/** @deprecated. replaced by startup_page_id but still used for export */
	startup_page?: number
	/** @deprecated.  used for export */
	allowed_pages?: number[]
}

export interface SurfacePanelConfig {
	// defaults from the panel - TODO properly
	brightness: number
	rotation: SurfaceRotation

	// companion owned defaults
	xOffset: number
	yOffset: number
	groupId: string | null

	// panel custom properties
	[key: string]: any
}

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

export interface OutboundSurfaceInfo {
	id: string
	enabled: boolean

	displayName: string
	type: 'plugin'
	moduleId: string
	instanceId: string
	config: Record<string, any>

	collectionId: string | null
	sortOrder: number
}

export interface OutboundSurfaceCollectionData {
	enabled: boolean
}

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
