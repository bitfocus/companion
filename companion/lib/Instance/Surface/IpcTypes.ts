import type { IpcWrapper } from './IpcWrapper.js'
import type { HIDDevice, LogLevel, SurfaceDrawProps } from '@companion-surface/base'
import type { OpenHidDeviceResult } from '@companion-surface/base/host'

export type SurfaceIpcWrapper = IpcWrapper<SurfaceModuleToHostEvents, HostToSurfaceModuleEvents>

export interface SurfaceModuleToHostEvents {
	register: (msg: RegisterMessage) => RegisterResponseMessage
	ready: (msg: Record<string, never>) => never

	disconnect: (msg: DisconnectMessage) => never

	/** The connection has a message for the Companion log */
	'log-message': (msg: LogMessageMessage) => never

	'input-press': (msg: InputPressMessage) => never
	'input-rotate': (msg: InputRotateMessage) => never

	'pincode-entry': (msg: PincodeEntryMessage) => never

	'set-variable-value': (msg: SetVariableValueMessage) => never
}

export interface HostToSurfaceModuleEvents {
	// /** Initialise the connection with the given config and label */
	// init: (msg: InitMessage) => InitResponseMessage
	/** Cleanup the connection in preparation for the thread/process to be terminated */
	destroy: (msg: Record<string, never>) => void

	checkHidDevice: (msg: CheckHidDeviceMessage) => CheckHidDeviceResponseMessage
	openHidDevice: (msg: OpenHidDeviceMessage) => OpenHidDeviceResponseMessage

	scanDevices: (msg: Record<string, never>) => ScanDevicesResponseMessage

	setBrightness: (msg: SetBrightnessMessage) => void
	drawControls: (msg: DrawControlMessage) => void
	setLocked: (msg: SetLockedMessage) => void
	setOutputVariable: (msg: SetOutputVariableMessage) => void
}

export interface RegisterMessage {
	verificationToken: string

	supportsDetection: boolean
	supportsHid: boolean
	supportsScan: boolean
}
export type RegisterResponseMessage = Record<string, never>

export interface CheckHidDeviceMessage {
	device: HIDDevice
}
export interface CheckHidDeviceResponseMessage {
	info: {
		surfaceId: string
		description: string
	} | null
}

export interface ScanDevicesResponseMessage {
	devices: {
		surfaceId: string
		description: string
	}[]
}

export interface OpenHidDeviceMessage {
	device: HIDDevice
}
export interface OpenHidDeviceResponseMessage {
	info: OpenHidDeviceResult | null // TODO - convert to safe form?
}

export interface DisconnectMessage {
	surfaceId: string
	reason: string | null
}

export interface LogMessageMessage {
	level: LogLevel
	message: string
}

export interface InputPressMessage {
	surfaceId: string
	controlId: string
	pressed: boolean
}

export interface InputRotateMessage {
	surfaceId: string
	controlId: string
	delta: number // should be -1 or 1, but others should be handled sensibly
}

export interface PincodeEntryMessage {
	surfaceId: string
	keycode: number
}

export interface SetVariableValueMessage {
	surfaceId: string
	name: string
	value: any
}

export interface SetBrightnessMessage {
	surfaceId: string
	brightness: number
}
export interface DrawControlMessage {
	surfaceId: string
	drawProps: IpcDrawProps[]
}

export interface IpcDrawProps extends Omit<SurfaceDrawProps, 'image'> {
	image?: string
}

export interface SetLockedMessage {
	surfaceId: string
	locked: boolean
	characterCount: number
}

export interface SetOutputVariableMessage {
	surfaceId: string
	name: string
	value: any
}
