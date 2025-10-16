import LogController, { Logger } from '../../Log/Controller.js'
import type { RespawnMonitor } from '@companion-app/shared/Respawn.js'
import type {
	DisconnectMessage,
	HostToSurfaceModuleEvents,
	InputPressMessage,
	InputRotateMessage,
	LogMessageMessage,
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
import { LogLevel } from '@companion-surface/base'
import type * as HID from 'node-hid'
import type { OpenDeviceResult } from '@companion-surface/base/host'
import { IpcWrapper, IpcEventHandlers } from './IpcWrapper.js'

export interface SurfaceChildHandlerDependencies {
	// readonly controls: ControlsController
	// readonly variables: VariablesController
	// readonly oscSender: ServiceOscSender

	readonly surfaceController: SurfaceController
	// readonly instanceDefinitions: InstanceDefinitions
	readonly instanceStatus: InstanceStatus
	// readonly sharedUdpManager: InstanceSharedUdpManager

	// readonly setConnectionConfig: (
	// 	connectionId: string,
	// 	config: unknown | null,
	// 	secrets: unknown | null,
	// 	newUpgradeIndex: number | null
	// ) => void
	readonly debugLogLine: (instanceId: string, level: string, message: string) => void
}

export interface SurfaceChildFeatures {
	readonly supportsDetection: boolean
	readonly supportsHid: boolean
	readonly supportsScan: boolean
}

export class SurfaceChildHandler implements ChildProcessHandlerBase {
	logger: Logger

	readonly #ipcWrapper: IpcWrapper<HostToSurfaceModuleEvents, SurfaceModuleToHostEvents>

	readonly #deps: SurfaceChildHandlerDependencies

	readonly #panels = new Map<string, SurfacePluginPanel>()

	readonly moduleId: string
	readonly instanceId: string

	readonly features: SurfaceChildFeatures

	/**
	 * Unsubscribe listeners, for use during cleanup
	 */
	#unsubListeners: () => void

	constructor(
		deps: SurfaceChildHandlerDependencies,
		monitor: RespawnMonitor,
		moduleId: string,
		instanceId: string,
		registerProps: Partial<RegisterMessage>
	) {
		this.logger = LogController.createLogger(`Surface/Wrapper/${instanceId}`)

		this.#deps = deps
		this.moduleId = moduleId
		this.instanceId = instanceId

		const funcs: IpcEventHandlers<SurfaceModuleToHostEvents> = {
			register: async () => {
				throw new Error('Not supported after initial registration')
			},
			ready: this.#handleReadyMessage.bind(this),

			disconnect: this.#handleDisconnectMessage.bind(this),

			shouldOpenDiscoveredSurface: this.#handleShouldOpenDiscoveredSurface.bind(this),
			notifyOpenedDiscoveredDevice: this.#handleNotifyOpenedDiscoveredDevice.bind(this),

			// TODO - this wants to be setup before init. how can that be done?
			'log-message': this.#handleLogMessage.bind(this),

			'input-press': this.#handleInputPress.bind(this),
			'input-rotate': this.#handleInputRotate.bind(this),

			'pincode-entry': this.#handlePincodeEntry.bind(this),

			'set-variable-value': this.#handleSetVariableValue.bind(this),
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

		this.features = {
			supportsDetection: !!registerProps.supportsDetection,
			supportsHid: !!registerProps.supportsHid,
			supportsScan: !!registerProps.supportsScan,
		}

		const messageHandler = (msg: any) => {
			this.#ipcWrapper.receivedMessage(msg)
		}
		monitor.child?.on('message', messageHandler)

		if (this.features.supportsScan || this.features.supportsHid) {
			this.#deps.surfaceController.on('scanDevices', this.#scanDevices)
		}

		this.#deps.surfaceController.initInstance(this.instanceId, this.features)

		this.#unsubListeners = () => {
			monitor.child?.off('message', messageHandler)
			this.#deps.surfaceController.off('scanDevices', this.#scanDevices)

			this.#deps.surfaceController.forgetInstance(this.instanceId)
		}
	}

	async init(): Promise<void> {
		// Nothing to do?
	}

	/**
	 * Tell the child instance class to 'destroy' itself
	 */
	async destroy(): Promise<void> {
		// Cleanup the system once the module is destroyed

		try {
			await this.#ipcWrapper.sendWithCb('destroy', {})
		} catch (e: any) {
			console.warn(`Destroy for "${this.instanceId}" errored: ${e}`)
		}

		// Stop ipc commands being received
		this.#unsubListeners()

		this.cleanup()
	}

	cleanup(): void {
		// TODO
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

	/**
	 * Handle a log message from the child process
	 */
	async #handleLogMessage(msg: LogMessageMessage): Promise<void> {
		if (msg.level === 'error' || msg.level === 'warn' || msg.level === 'info') {
			// Ignore debug from modules in main log
			this.logger.log(msg.level, msg.message)
		}

		// Send everything to the 'debug' page
		this.#sendToModuleLog(msg.level, msg.message.toString())
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
	/**
	 * Send a message to the module 'debug' log page
	 */
	#sendToModuleLog(level: LogLevel | 'system', message: string): void {
		this.#deps.debugLogLine(this.instanceId, level, message)
	}
}
