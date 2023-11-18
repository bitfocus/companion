export interface BaseDeviceInfo {
	id: string
	type: string
	integrationType: string
	name: string
	index: number
}
export type OfflineDeviceInfo = BaseDeviceInfo

export interface AvailableDeviceInfo extends BaseDeviceInfo {
	location: string
	configFields: string[]
}

export interface ClientDevicesList {
	available: Record<string, AvailableDeviceInfo | undefined>
	offline: Record<string, OfflineDeviceInfo | undefined>
}
