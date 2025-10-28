import LogController, { type Logger } from '../../Log/Controller.js'
import type { RespawnMonitor } from '@companion-app/shared/Respawn.js'
import type {
	DisconnectMessage,
	FirmwareUpdateInfoMessage,
	HostToSurfaceModuleEvents,
	InputPressMessage,
	InputRotateMessage,
	LogMessageMessage,
	NotifyConnectionsForgottenMessage,
	NotifyConnectionsFoundMessage,
	NotifyOpenedDeviceMessage,
	PincodeEntryMessage,
	RegisterMessage,
	SetVariableValueMessage,
	ShouldOpenDeviceMessage,
	ShouldOpenDeviceResponseMessage,
	SurfaceModuleToHostEvents,
} from './IpcTypes.js'
import { SurfacePluginPanel } from '../../Surface/PluginPanel.js'
import type { ChildProcessHandlerBase } from '../ProcessManager.js'
import type { InstanceStatus } from '../Status.js'
import type { SurfaceController } from '../../Surface/Controller.js'
import type { OpenDeviceResult } from '@companion-surface/host'
import type * as HID from 'node-hid'
import { IpcWrapper, type IpcEventHandlers } from './IpcWrapper.js'
import type { CompanionSurfaceConfigField, ModernOutboundSurfaceInfo } from '@companion-app/shared/Model/Surfaces.js'
import type { RemoteSurfaceConnectionInfo } from '@companion-surface/base'

export interface SurfaceChildHandlerDependencies {
	readonly surfaceController: SurfaceController
	readonly instanceStatus: InstanceStatus

	readonly debugLogLine: (
		instanceId: string,
		time: number | null,
		source: string,
		level: string,
		message: string
	) => void

	readonly invalidateClientJson: (instanceId: string) => void
}

export interface SurfaceChildFeatures {
	readonly supportsDetection: boolean
	readonly supportsHid: boolean
	readonly supportsScan: boolean
	readonly supportsRemote: {
		configFields: CompanionSurfaceConfigField[]
	} | null
}

export class SurfaceChildHandler implements ChildProcessHandlerBase {
	logger: Logger

	readonly #ipcWrapper: IpcWrapper<HostToSurfaceModuleEvents, SurfaceModuleToHostEvents>

	readonly #deps: SurfaceChildHandlerDependencies

	readonly #panels = new Map<string, SurfacePluginPanel>()

	readonly moduleId: string
	readonly instanceId: string

	#features: SurfaceChildFeatures

	get features(): SurfaceChildFeatures {
		return this.#features
	}

	/**
	 * Unsubscribe listeners, for use during cleanup
	 */
	#unsubListeners: () => void

	constructor(
		deps: SurfaceChildHandlerDependencies,
		monitor: RespawnMonitor,
		moduleId: string,
		instanceId: string,
		onRegister: (verificationToken: string) => Promise<void>
	) {
		this.logger = LogController.createLogger(`Surface/Wrapper/${instanceId}`)

		this.#deps = deps
		this.moduleId = moduleId
		this.instanceId = instanceId

		// Default features if not yet registered
		this.#features = {
			supportsDetection: false,
			supportsHid: false,
			supportsScan: false,
			supportsRemote: null,
		}

		this.#unsubListeners = () => null // will be set properly on registration

		const funcs: IpcEventHandlers<SurfaceModuleToHostEvents> = {
			register: async (msg: RegisterMessage) => {
				// Call back to ProcessManager to handle registration
				await onRegister(msg.verificationToken)
				// Complete local registration with the props
				this.#completeRegistration(msg)
				return {}
			},
			ready: this.#handleReadyMessage.bind(this),

			disconnect: this.#handleDisconnectMessage.bind(this),

			shouldOpenDiscoveredSurface: this.#handleShouldOpenDiscoveredSurface.bind(this),
			notifyOpenedDiscoveredDevice: this.#handleNotifyOpenedDiscoveredDevice.bind(this),

			notifyConnectionsFound: this.#handleNotifyConnectionsFound.bind(this),
			notifyConnectionsForgotten: this.#handleNotifyConnectionsForgotten.bind(this),

			'log-message': this.#handleLogMessage.bind(this),

			'input-press': this.#handleInputPress.bind(this),
			'input-rotate': this.#handleInputRotate.bind(this),

			'pincode-entry': this.#handlePincodeEntry.bind(this),

			'set-variable-value': this.#handleSetVariableValue.bind(this),

			'firmware-update-info': this.#handleFirmwareUpdateInfo.bind(this),
		}

		this.#ipcWrapper = new IpcWrapper(
			funcs,
			(msg) => {
				if (monitor.child) {
					monitor.child.send(msg)
				} else {
					this.logger.debug(`Child is not running, unable to send message: ${JSON.stringify(msg)}`)
				}
			},
			5000
		)

		// Attach message handler to receive messages from child process
		const messageHandler = (msg: any) => {
			this.#ipcWrapper.receivedMessage(msg)
		}
		monitor.on('message', messageHandler)
		this.#unsubListeners = () => monitor.off('message', messageHandler)
	}

	#completeRegistration(registerProps: RegisterMessage): void {
		this.#features = {
			supportsDetection: !!registerProps.supportsDetection,
			supportsHid: !!registerProps.supportsHid,
			supportsScan: !!registerProps.supportsScan,
			supportsRemote: registerProps.supportsOutbound ?? null,
		}
		this.logger.debug(`Received features: ${JSON.stringify(this.features)}`)

		if (this.features.supportsScan || this.features.supportsDetection || this.features.supportsHid) {
			this.#deps.surfaceController.on('scanDevices', this.#scanDevices)
		}

		if (this.features.supportsRemote) {
			this.#deps.surfaceController.outbound.events.on(`startStop:${this.instanceId}`, this.#startStopConnections)

			// Compute default config for the instance
			const config: Record<string, any> = {}
			for (const fieldDef of this.features.supportsRemote.configFields) {
				// Handle different field types that have default values
				if ('default' in fieldDef && fieldDef.default !== undefined) {
					config[fieldDef.id] = fieldDef.default
				}
			}

			this.#deps.surfaceController.outbound.updateDefaultConfigForSurfaceInstance(this.instanceId, config)
		}
	}

	#startStopConnections = (connectionInfo: ModernOutboundSurfaceInfo) => {
		if (connectionInfo.enabled) {
			this.#ipcWrapper
				.sendWithCb('setupRemoteConnections', {
					connectionInfos: [
						{
							connectionId: connectionInfo.id,
							config: connectionInfo.config,
						},
					],
				})
				.catch((e) => {
					this.logger.warn(`Error setting up remote connection: ${e.message}`)
				})
		} else {
			this.#ipcWrapper
				.sendWithCb('stopRemoteConnections', {
					connectionIds: [connectionInfo.id],
				})
				.catch((e) => {
					this.logger.warn(`Error tearing down remote connection: ${e.message}`)
				})
		}
	}

	async init(): Promise<void> {
		// Nothing to do
	}
	async ready(): Promise<void> {
		this.#deps.surfaceController.initInstance(this.instanceId, this.features)

		this.#deps.invalidateClientJson(this.instanceId)

		// Start up any existing outbound connections for this instance
		const remoteConnections = this.#deps.surfaceController.outbound.getAllEnabledConnectionsForInstance(this.instanceId)
		this.#ipcWrapper
			.sendWithCb('setupRemoteConnections', {
				connectionInfos: remoteConnections.map(
					(conn) =>
						({
							connectionId: conn.id,
							config: conn.config,
						}) satisfies RemoteSurfaceConnectionInfo
				),
			})
			.catch((e) => {
				this.logger.warn(`Error setting up initial remote connections: ${e.message}`)
			})
	}

	/**
	 * Tell the child instance class to 'destroy' itself
	 */
	async destroy(): Promise<void> {
		// Cleanup the system once the module is destroyed

		try {
			await this.#ipcWrapper.sendWithCb('destroy', {})
		} catch (e: any) {
			this.logger.warn(`Destroy for "${this.instanceId}" errored: ${e}`)
		}

		// Stop ipc commands being received
		this.#unsubListeners()

		this.cleanup()
	}

	cleanup(): void {
		this.#deps.invalidateClientJson(this.instanceId)
		this.#deps.surfaceController.outbound.updateDefaultConfigForSurfaceInstance(this.instanceId, null)
		this.#deps.surfaceController.outbound.events.off(`startStop:${this.instanceId}`, this.#startStopConnections)
		this.#deps.surfaceController.outbound.discovery.instanceForget(this.instanceId)

		this.#deps.surfaceController.off('scanDevices', this.#scanDevices)
		this.#deps.surfaceController.unloadSurfacesForInstance(this.instanceId)
	}

	#scanDevices = (hidDevices: HID.Device[]): void => {
		if (this.features.supportsScan || this.features.supportsDetection) {
			this.#ipcWrapper
				.sendWithCb('scanDevices', {})
				.then((msg) => {
					this.logger.debug(`scan devices returned ${msg.devices.length} devices`)

					for (const device of msg.devices) {
						// Future: track this as a known surface?

						// Already opened, stop here
						if (this.#panels.has(device.surfaceId)) return

						// Check if it can be opened here
						const reserveCb = this.#deps.surfaceController.reserveSurfaceForOpening(device.surfaceId)
						if (!reserveCb) return

						this.#ipcWrapper
							.sendWithCb('openScannedDevice', { device })
							.then(async (openInfo) => {
								if (!openInfo.info) return

								await this.#setupSurfacePanel(openInfo.info)
							})
							.finally(() => {
								// clear the reservation, if it hasnt been used
								reserveCb()
							})
							.catch((e) => {
								this.logger.warn(`Error performing openScannedDevice: ${e.message}`)
							})
					}
				})
				.catch((e) => {
					this.logger.warn(`Error performing scanDevices: ${e.message}`)
				})
		}

		if (this.features.supportsHid) {
			for (const device of hidDevices) {
				this.#ipcWrapper
					.sendWithCb('checkHidDevice', { device })
					.then(async (msg) => {
						// If no info, then device is not for us
						if (!msg.info) return

						// Future: track this as a known surface?

						// Already opened, stop here
						if (this.#panels.has(msg.info.surfaceId)) return

						// Check if it can be opened here
						const reserveCb = this.#deps.surfaceController.reserveSurfaceForOpening(msg.info.surfaceId)
						if (!reserveCb) return

						try {
							// Try and open it
							const openInfo = await this.#ipcWrapper.sendWithCb('openHidDevice', { device })
							if (!openInfo.info) return

							await this.#setupSurfacePanel(openInfo.info)
						} finally {
							// clear the reservation, if it hasnt been used
							reserveCb()
						}
					})
					.catch((e) => {
						this.logger.warn(`Error performing checkHidDevice: ${e.message}`)
					})
			}
		}
	}

	async #setupSurfacePanel(info: OpenDeviceResult): Promise<void> {
		try {
			this.logger.info(`Opening surface panel: ${info.surfaceId} - ${info.description}`)

			if (this.#panels.has(info.surfaceId)) {
				this.logger.warn(`Surface with id ${info.surfaceId} is already opened`)

				// TODO - tell the child, as something has probably gone wrong
				return
			}

			const panel = new SurfacePluginPanel(
				this.#ipcWrapper,
				this.instanceId,
				info,
				this.#deps.surfaceController.surfaceExecuteExpression.bind(this.#deps.surfaceController)
			)
			this.#panels.set(info.surfaceId, panel)

			this.#deps.surfaceController.addPluginPanel(this.moduleId, panel)

			this.logger.info(`Surface panel ready: ${info.surfaceId}`)
		} catch (e) {
			// TODO - tell the child, as something has gone wrong
			this.logger.warn(`Error opening surface panel: ${e}`)
		}
	}

	async #handleReadyMessage(_msg: Record<string, never>): Promise<void> {
		this.#deps.instanceStatus.updateInstanceStatus(this.instanceId, 'ok', null)

		// TODO - more?
	}

	async #handleDisconnectMessage(msg: DisconnectMessage): Promise<void> {
		const surface = this.#panels.get(msg.surfaceId)
		if (surface) {
			this.logger.info(`Surface panel disconnected: ${msg.surfaceId} (${msg.reason ?? 'no reason given'})`)
			surface.emit('remove')
			this.#panels.delete(msg.surfaceId)
		} else {
			this.logger.warn(`Received disconnect for unknown surface: ${msg.surfaceId}`)
		}
	}

	async #handleShouldOpenDiscoveredSurface(msg: ShouldOpenDeviceMessage): Promise<ShouldOpenDeviceResponseMessage> {
		// Already opened, stop here
		if (this.#panels.has(msg.info.surfaceId)) return { shouldOpen: false }

		// Check if it can be opened here
		const reserveCb = this.#deps.surfaceController.reserveSurfaceForOpening(msg.info.surfaceId)
		if (!reserveCb) return { shouldOpen: false }

		// Clear the reservation, as we are just checking
		reserveCb()

		return { shouldOpen: true }
	}
	async #handleNotifyOpenedDiscoveredDevice(msg: NotifyOpenedDeviceMessage): Promise<void> {
		this.#setupSurfacePanel(msg.info).catch((e) => {
			this.logger.warn(`Error opening discovered surface panel: ${e}`)
		})
	}

	async #handleNotifyConnectionsFound(msg: NotifyConnectionsFoundMessage): Promise<void> {
		try {
			this.#deps.surfaceController.outbound.discovery.instanceConnectionsFound(this.instanceId, msg.connectionInfos)
		} catch (e) {
			this.logger.warn(`Error handling notifyConnectionsFound: ${e}`)
		}
	}
	async #handleNotifyConnectionsForgotten(msg: NotifyConnectionsForgottenMessage): Promise<void> {
		try {
			this.#deps.surfaceController.outbound.discovery.instanceConnectionsForgotten(this.instanceId, msg.connectionIds)
		} catch (e) {
			this.logger.warn(`Error handling notifyConnectionsForgotten: ${e}`)
		}
	}

	/**
	 * Handle a log message from the child process
	 */
	async #handleLogMessage(msg: LogMessageMessage): Promise<void> {
		if (msg.level === 'error' || msg.level === 'warn' || msg.level === 'info') {
			// Ignore debug from modules in main log
			this.logger.log({
				source: msg.source ? `${this.logger.source}/${msg.source}` : this.logger.source,
				level: msg.level,
				message: msg.message,
			})
		}

		// Send everything to the 'debug' page
		this.#deps.debugLogLine(this.instanceId, msg.time, msg.source || '/', msg.level, msg.message.toString())
	}

	async #handleInputPress(msg: InputPressMessage): Promise<void> {
		const surface = this.#panels.get(msg.surfaceId)
		if (surface) {
			surface.inputPress(msg.controlId, msg.pressed)
		} else {
			this.logger.warn(`Received input press for unknown surface: ${msg.surfaceId}`)
		}
	}
	async #handleInputRotate(msg: InputRotateMessage): Promise<void> {
		const surface = this.#panels.get(msg.surfaceId)
		if (surface) {
			surface.inputRotate(msg.controlId, msg.delta)
		} else {
			this.logger.warn(`Received input rotate for unknown surface: ${msg.surfaceId}`)
		}
	}
	async #handlePincodeEntry(msg: PincodeEntryMessage): Promise<void> {
		const surface = this.#panels.get(msg.surfaceId)
		if (surface) {
			surface.inputPincode(msg.keycode)
		} else {
			this.logger.warn(`Received input pincode for unknown surface: ${msg.surfaceId}`)
		}
	}
	async #handleSetVariableValue(msg: SetVariableValueMessage): Promise<void> {
		const surface = this.#panels.get(msg.surfaceId)
		if (surface) {
			surface.inputVariableValue(msg.name, msg.value)
		} else {
			this.logger.warn(`Received input variable value for unknown surface: ${msg.surfaceId}`)
		}
	}

	async #handleFirmwareUpdateInfo(msg: FirmwareUpdateInfoMessage): Promise<void> {
		const surface = this.#panels.get(msg.surfaceId)
		if (surface) {
			surface.updateFirmwareUpdateInfo(msg.updateInfo?.updateUrl ?? null)
		} else {
			this.logger.warn(`Received firmware updateinfo for unknown surface: ${msg.surfaceId}`)
		}
	}
}
