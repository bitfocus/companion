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
