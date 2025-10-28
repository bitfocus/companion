import type { IpcWrapper } from './IpcWrapper.js'
import type {
	HIDDevice,
	LogLevel,
	SurfaceDrawProps,
	OpenDeviceResult,
	SurfaceFirmwareUpdateInfo,
} from '@companion-surface/host'
import type { CompanionSurfaceConfigField } from '@companion-app/shared/Model/Surfaces.js'
import type { DiscoveredRemoteSurfaceInfo, RemoteSurfaceConnectionInfo } from '@companion-surface/base'

export type SurfaceIpcWrapper = IpcWrapper<SurfaceModuleToHostEvents, HostToSurfaceModuleEvents>

export interface SurfaceModuleToHostEvents {
	register: (msg: RegisterMessage) => RegisterResponseMessage
	ready: (msg: Record<string, never>) => never

	disconnect: (msg: DisconnectMessage) => never

	shouldOpenDiscoveredSurface: (msg: ShouldOpenDeviceMessage) => ShouldOpenDeviceResponseMessage
	notifyOpenedDiscoveredDevice: (msg: NotifyOpenedDeviceMessage) => never

	notifyConnectionsFound: (msg: NotifyConnectionsFoundMessage) => never
	notifyConnectionsForgotten: (msg: NotifyConnectionsForgottenMessage) => never

	/** The connection has a message for the Companion log */
	'log-message': (msg: LogMessageMessage) => never

	'input-press': (msg: InputPressMessage) => never
	'input-rotate': (msg: InputRotateMessage) => never

	'pincode-entry': (msg: PincodeEntryMessage) => never

	'set-variable-value': (msg: SetVariableValueMessage) => never

	'firmware-update-info': (msg: FirmwareUpdateInfoMessage) => never
}

export interface HostToSurfaceModuleEvents {
	/** Cleanup the connection in preparation for the thread/process to be terminated */
	destroy: (msg: Record<string, never>) => void

	checkHidDevice: (msg: CheckHidDeviceMessage) => CheckHidDeviceResponseMessage
	openHidDevice: (msg: OpenHidDeviceMessage) => OpenDeviceResponseMessage

	scanDevices: (msg: Record<string, never>) => ScanDevicesResponseMessage
	openScannedDevice: (msg: OpenScannedDeviceMessage) => OpenDeviceResponseMessage

	setBrightness: (msg: SetBrightnessMessage) => void
	drawControls: (msg: DrawControlMessage) => void
	blankSurface: (msg: BlankSurfaceMessage) => void
	setLocked: (msg: SetLockedMessage) => void
	setOutputVariable: (msg: SetOutputVariableMessage) => void

	setupRemoteConnections: (msg: SetupRemoteConnectionsMessage) => void
	stopRemoteConnections: (msg: StopRemoteConnectionsMessage) => void
}

export interface RegisterMessage {
	verificationToken: string

	supportsDetection: boolean
	supportsHid: boolean
	supportsScan: boolean
	supportsOutbound: {
		configFields: CompanionSurfaceConfigField[]
		configMatchesExpression: string | null
	} | null
}
export type RegisterResponseMessage = Record<string, never>

export interface CheckHidDeviceMessage {
	device: HIDDevice
}
export interface CheckHidDeviceResponseMessage {
	info: CheckDeviceInfo | null
}
export interface CheckDeviceInfo {
	surfaceId: string
	description: string
}

export interface ScanDevicesResponseMessage {
	devices: CheckDeviceInfo[]
}

export interface OpenScannedDeviceMessage {
	device: CheckDeviceInfo
}

export interface OpenHidDeviceMessage {
	device: HIDDevice
}
export interface OpenDeviceResponseMessage {
	info: OpenDeviceResult | null // TODO - convert to safe form?
}

export interface DisconnectMessage {
	surfaceId: string
	reason: string | null
}

export interface ShouldOpenDeviceMessage {
	info: CheckDeviceInfo
}
export interface ShouldOpenDeviceResponseMessage {
	shouldOpen: boolean
}
export interface NotifyOpenedDeviceMessage {
	info: OpenDeviceResult // TODO - convert to safe form?
}

export interface LogMessageMessage {
	time: number
	source: string | undefined
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

export interface FirmwareUpdateInfoMessage {
	surfaceId: string

	updateInfo: SurfaceFirmwareUpdateInfo | null
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

export interface BlankSurfaceMessage {
	surfaceId: string
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

export interface SetupRemoteConnectionsMessage {
	connectionInfos: RemoteSurfaceConnectionInfo[]
}
export interface StopRemoteConnectionsMessage {
	connectionIds: string[]
}

export interface NotifyConnectionsFoundMessage {
	connectionInfos: DiscoveredRemoteSurfaceInfo[]
}
export interface NotifyConnectionsForgottenMessage {
	connectionIds: string[]
}
