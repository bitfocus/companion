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

	xOffset: number
	yOffset: number
	layout: SurfaceLayoutSchema | null
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

export type SurfaceLayoutSchema = SurfaceLayoutSchemaGrid | SurfaceLayoutSchemaComplex

export interface SurfaceLayoutSchemaBase {
	id: string
	name: string
}

export interface SurfaceLayoutSchemaGrid {
	id: string
	name: string

	type: 'grid'

	rows: number
	columns: number
}

export interface SurfaceLayoutSchemaComplex {
	id: string
	name: string

	type: 'complex'

	/**
	 * Background image, recommended to be a svg when possible
	 */
	backgroundImage: string
}
