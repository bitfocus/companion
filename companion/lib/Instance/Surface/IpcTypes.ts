import type { IpcWrapper } from '../Common/IpcWrapper.js'
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
	forgetDiscoveredSurfaces: (msg: ForgetDiscoveredSurfacesMessage) => never

	notifyConnectionsFound: (msg: NotifyConnectionsFoundMessage) => never
	notifyConnectionsForgotten: (msg: NotifyConnectionsForgottenMessage) => never

	/** The connection has a message for the Companion log */
	'log-message': (msg: LogMessageMessage) => never

	'input-press': (msg: InputPressMessage) => never
	'input-rotate': (msg: InputRotateMessage) => never
	'change-page': (msg: ChangePageMessage) => never

	'pincode-entry': (msg: PincodeEntryMessage) => never

	'set-variable-value': (msg: SetVariableValueMessage) => never

	'firmware-update-info': (msg: FirmwareUpdateInfoMessage) => never
}

export interface HostToSurfaceModuleEvents {
	/** Cleanup the connection in preparation for the thread/process to be terminated */
	destroy: (msg: Record<string, never>) => void

	checkHidDevices: (msg: CheckHidDevicesMessage) => CheckHidDevicesResponseMessage
	openHidDevice: (msg: OpenHidDeviceMessage) => OpenDeviceResponseMessage

	scanDevices: (msg: Record<string, never>) => ScanDevicesResponseMessage
	openScannedDevice: (msg: OpenScannedDeviceMessage) => OpenDeviceResponseMessage

	/** Close a specific surface, releasing the underlying device */
	closeSurface: (msg: CloseSurfaceMessage) => void

	readySurface: (msg: ReadySurfaceMessage) => void
	updateConfig: (msg: UpdateConfigMessage) => void

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

export interface CheckHidDevicesMessage {
	devices: HIDDevice[]
}
export interface CheckHidDevicesResponseMessage {
	devices: CheckDeviceInfo[]
}

/** Info returned from checkHidDevices and scanDevices */
export interface CheckDeviceInfo {
	devicePath: string
	surfaceId: string
	surfaceIdIsNotUnique: boolean
	description: string
}

export interface ScanDevicesResponseMessage {
	devices: CheckDeviceInfo[]
}

export interface OpenScannedDeviceMessage {
	device: CheckDeviceInfo
	/** The collision-resolved surface ID to use when opening */
	resolvedSurfaceId: string
}

export interface CloseSurfaceMessage {
	surfaceId: string
}

export interface ReadySurfaceMessage {
	surfaceId: string
	initialConfig: Record<string, any>
}
export interface UpdateConfigMessage {
	surfaceId: string
	newConfig: Record<string, any>
}

export interface OpenHidDeviceMessage {
	device: HIDDevice
	/** The collision-resolved surface ID to use when opening */
	resolvedSurfaceId: string
}
export interface OpenDeviceResponseMessage {
	info: HostOpenDeviceResult | null
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
	/** The collision-resolved surface ID to use when opening */
	resolvedSurfaceId: string
}
export interface NotifyOpenedDeviceMessage {
	info: HostOpenDeviceResult
}
export interface ForgetDiscoveredSurfacesMessage {
	/** The device paths of the surfaces to forget */
	devicePaths: string[]
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

export interface ChangePageMessage {
	surfaceId: string
	forward: boolean
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

export interface HostOpenDeviceResult extends Omit<OpenDeviceResult, 'configFields'> {
	configFields: CompanionSurfaceConfigField[] | null

	// TODO - sanitise more?
}
