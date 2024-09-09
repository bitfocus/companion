import type { Operation as JsonPatchOperation } from 'fast-json-patch'
import type {
	DropdownChoice,
	CompanionInputFieldCheckbox,
	CompanionInputFieldDropdown,
	CompanionInputFieldNumber,
	CompanionInputFieldCustomVariable,
} from '@companion-module/base'
import { CompanionInputFieldTextInputExtended, EncodeIsVisible2 } from './Options.js'

export interface ClientSurfaceItem {
	id: string
	type: string
	integrationType: string
	name: string
	configFields: CompanionSurfaceConfigField[]
	isConnected: boolean
	displayName: string
	location: string | null
	remoteConnectionId: string | null
}

export interface ClientDevicesListItem {
	id: string
	index: number | undefined
	displayName: string
	isAutoGroup: boolean
	surfaces: ClientSurfaceItem[]
}

export interface SurfaceGroupConfig {
	name: string
	last_page: number
	startup_page: number
	use_last_page: boolean
}

export type SurfacePanelConfig = Record<string, any>

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
