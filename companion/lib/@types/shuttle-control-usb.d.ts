declare module 'shuttle-control-usb' {
	import type { EventEmitter } from 'events'
	import type { HID } from 'node-hid'

	export interface ShuttleEvents {
		error: [Error]
		buttondown: [index: number, deviceId: string]
		buttonup: [index: number, deviceId: string]
		'jog-dir': [delta: number, deviceId: string]
		'shuttle-trans': [previous: number, current: number, deviceId: string]
		disconnected: [deviceId: string]
	}

	export interface ShuttleDeviceInfo {
		id: string
		path: string
		name: string
		hasShuttle: boolean
		hasJog: boolean
		numButtons: number
	}

	class Shuttle extends EventEmitter<ShuttleEvents> {
		readonly vids: Record<string, number>
		readonly pids: Record<string, number>

		start(watchUsb = true): void
		stop(): void

		getDeviceList(): ShuttleDeviceInfo[]

		getDeviceById(deviceId: string): ShuttleDeviceInfo | undefined
		getDeviceByPath(devicePath: string): ShuttleDeviceInfo | undefined
		getRawHidDevice(deviceId: string): HID | undefined

		connect(devicePath: string): void
	}

	export default new Shuttle()
}
