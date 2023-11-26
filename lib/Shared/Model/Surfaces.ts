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
	index: number
	displayName: string
	isAutoGroup: boolean
	surfaces: ClientSurfaceItem[]
}
