import type { Operation as JsonPatchOperation } from 'fast-json-patch'
import type {
	DropdownChoice,
	CompanionInputFieldCheckbox,
	CompanionInputFieldDropdown,
	CompanionInputFieldNumber,
	CompanionInputFieldCustomVariable,
} from '@companion-module/base'
import { CompanionInputFieldTextInputExtended, EncodeIsVisible2 } from './Options.js'

export type GridSize = { columns: number; rows: number }
export type SurfaceRotation = 'surface90' | 'surface-90' | 'surface180' | 'surface0' | 0 | -90 | 90 | 180

export interface RowsAndColumns {
	rows: number
	columns: number
}

export interface SurfaceFirmwareUpdateInfo {
	updaterDownloadUrl: string
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

	hasFirmwareUpdates: SurfaceFirmwareUpdateInfo | null

	size: RowsAndColumns | null
	rotation: SurfaceRotation | null
	offset: RowsAndColumns | null
}

export interface ClientDevicesListItem {
	id: string
	index: number | undefined
	displayName: string
	isAutoGroup: boolean
	surfaces: ClientSurfaceItem[]
}

export interface SurfaceConfig {
	config: SurfacePanelConfig
	groupConfig: SurfaceGroupConfig

	groupId: string | null

	name?: string

	// Properties defined by the panel/integration, that may not be defined for old configs
	type: string | undefined
	integrationType: string | undefined
	gridSize: GridSize | undefined
}

export interface SurfaceGroupConfig {
	name: string
	last_page_id: string
	startup_page_id: string
	use_last_page: boolean

	/** @deprecated. replaced by last_page_id */
	last_page?: number
	/** @deprecated. replaced by startup_page_id */
	startup_page?: number
}

export interface SurfacePanelConfig {
	// defaults from the panel - TODO properly
	brightness: number
	rotation: SurfaceRotation

	// companion owned defaults
	never_lock: boolean
	xOffset: number
	yOffset: number
	groupId: string | null

	// panel custom properties
	[key: string]: any
}

export type SurfacesUpdate = SurfacesUpdateRemoveOp | SurfacesUpdateAddOp | SurfacesUpdateUpdateOp

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

	patch: JsonPatchOperation[]
}

export interface OutboundSurfaceInfo {
	id: string
	displayName: string
	type: 'elgato'
	enabled: boolean
	address: string
	port: number | undefined
}

export type OutboundSurfacesUpdate = OutboundSurfacesUpdateRemoveOp | OutboundSurfacesUpdateAddOp

export interface OutboundSurfacesUpdateRemoveOp {
	type: 'remove'
	itemId: string
}
export interface OutboundSurfacesUpdateAddOp {
	type: 'add'
	itemId: string

	info: OutboundSurfaceInfo
}

export type ClientDiscoveredSurfaceInfo = ClientDiscoveredSurfaceInfoSatellite | ClientDiscoveredSurfaceInfoStreamDeck

export interface ClientDiscoveredSurfaceInfoSatellite {
	id: string

	surfaceType: 'satellite'

	name: string
	addresses: string[]
	port: number

	apiEnabled: boolean
}

export interface ClientDiscoveredSurfaceInfoStreamDeck {
	id: string

	surfaceType: 'streamdeck'

	name: string
	address: string
	port: number

	modelName: string
	serialnumber: string | undefined
}

export type SurfacesDiscoveryUpdate = SurfaceDiscoveryUpdateRemoveOp | SurfaceDiscoveryUpdateUpdateOp

export interface SurfaceDiscoveryUpdateRemoveOp {
	type: 'remove'
	itemId: string
}
export interface SurfaceDiscoveryUpdateUpdateOp {
	type: 'update'
	// itemId: string

	info: ClientDiscoveredSurfaceInfo
}

export interface CompanionExternalAddresses {
	addresses: DropdownChoice[]
}

export type CompanionSurfaceInputFieldTextInput = Omit<CompanionInputFieldTextInputExtended, 'useVariables'>

export type CompanionSurfaceConfigField =
	| EncodeIsVisible2<CompanionSurfaceInputFieldTextInput>
	| EncodeIsVisible2<CompanionInputFieldDropdown>
	| EncodeIsVisible2<CompanionInputFieldNumber>
	| EncodeIsVisible2<CompanionInputFieldCheckbox>
	| EncodeIsVisible2<CompanionInputFieldCustomVariable>
