import type { Operation as JsonPatchOperation } from 'fast-json-patch'

export interface ClientSurfaceItem {
	id: string
	type: string
	integrationType: string
	name: string
	configFields: string[]
	isConnected: boolean
	displayName: string
	location: string | null
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

export interface ClientDiscoveredSurfaceInfo {
	id: string

	surfaceType: 'satellite'

	name: string
	addresses: string[]
	port: number

	apiEnabled: boolean
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
