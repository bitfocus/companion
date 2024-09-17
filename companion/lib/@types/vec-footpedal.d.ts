declare module 'vec-footpedal' {
	import type { EventEmitter } from 'events'
	import type { HID } from 'node-hid'

	export interface VecFootpedalEvents {
		error: [Error]
		buttondown: [index: number, deviceId: string]
		buttonup: [index: number, deviceId: string]
		disconnected: [deviceId: string]
	}

	export interface VecFootpedalDeviceInfo {
		id: string
		path: string
		name: string
		numButtons: number
	}

	class VecFootpedal extends EventEmitter<VecFootpedalEvents> {
		readonly vids: Record<string, number>
		readonly pids: Record<string, number>

		start(watchUsb = true): void
		stop(): void

		getDeviceList(): VecFootpedalDeviceInfo[]

		getDeviceById(deviceId: string): VecFootpedalDeviceInfo | undefined
		getDeviceByPath(devicePath: string): VecFootpedalDeviceInfo | undefined
		getRawHidDevice(deviceId: string): HID | undefined

		connect(devicePath: string): void
	}

	export default new VecFootpedal()
}
