import LogController, { Logger } from '../../Log/Controller.js'
import { IpcEventHandlers, IpcWrapper } from '@companion-module/base/dist/host-api/ipc-wrapper.js'
import type { RespawnMonitor } from '@companion-app/shared/Respawn.js'
import type {
	HostToSurfaceModuleEvents,
	InputPressMessage,
	InputRotateMessage,
	LogMessageMessage,
	PincodeEntryMessage,
	SetVariableValueMessage,
	SurfaceModuleToHostEvents,
} from '../../Surface/Plugin/IpcTypes.js'
import { SurfacePluginPanel } from '../../Surface/Plugin/Panel.js'
import type { ChildProcessHandlerBase } from '../ProcessManager.js'

export class SurfaceChildHandler implements ChildProcessHandlerBase {
	logger: Logger

	readonly #ipcWrapper: IpcWrapper<HostToSurfaceModuleEvents, SurfaceModuleToHostEvents>

	readonly #panels = new Map<string, SurfacePluginPanel>()

	readonly pluginId: string

	/**
	 * Unsubscribe listeners, for use during cleanup
	 */
	#unsubListeners: () => void

	constructor(monitor: RespawnMonitor, pluginId: string) {
		this.logger = LogController.createLogger(`Surface/Wrapper/${pluginId}`)

		this.pluginId = pluginId

		const funcs: IpcEventHandlers<SurfaceModuleToHostEvents> = {
			register: () => {
				throw new Error('Not supported after initial registration')
			},
			ready: () => {
				// TODO - this must mean it is unused?
				throw new Error('Not supported after initial registration')
			},

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

		const messageHandler = (msg: any) => {
			this.#ipcWrapper.receivedMessage(msg)
		}
		monitor.child?.on('message', messageHandler)

		this.#unsubListeners = () => {
			monitor.child?.off('message', messageHandler)
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
			console.warn(`Destroy for "${this.pluginId}" errored: ${e}`)
		}

		// Stop ipc commands being received
		this.#unsubListeners()

		this.cleanup()
	}

	cleanup(): void {
		// TODO
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
		// TODO?
		// this.#sendToModuleLog(msg.level, msg.message.toString())
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
}
