import jsonPatch from 'fast-json-patch'
import { isEqual } from 'lodash-es'
// import LogController from '../Log/Controller.js'
import { EventEmitter } from 'events'
import type { ConnectionStatusEntry } from '@companion-app/shared/Model/Common.js'
import type { UIHandler, ClientSocket } from '../UI/Handler.js'
import type { ControlsController } from '../Controls/Controller.js'

export interface InstanceStatusEvents {
	status_change: [statuses: Record<string, ConnectionStatusEntry>]
}

export class InstanceStatus extends EventEmitter<InstanceStatusEvents> {
	/**
	 * The latest statuses object
	 * levels: null = unknown, see updateInstanceStatus for possible values
	 */
	#instanceStatuses: Record<string, ConnectionStatusEntry> = {}

	// readonly #logger = LogController.createLogger('Instance/Status')

	readonly #io: UIHandler
	readonly #controls: ControlsController

	constructor(io: UIHandler, controls: ControlsController) {
		super()

		this.#io = io
		this.#controls = controls
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		client.onPromise('connections:get-statuses', () => {
			return this.#instanceStatuses
		})
	}

	/**
	 * Update the status of a connection
	 */
	updateInstanceStatus(connectionId: string, level: string | null, msg: string | null): void {
		let category: string | null = 'warning'

		switch (level) {
			case null:
				category = null
				break
			case 'ok':
				category = 'good'
				break
			case 'connecting':
				category = 'error'
				level = 'Connecting'
				break
			case 'disconnected':
				category = 'error'
				level = 'Disconnected'
				break
			case 'connection_failure':
				category = 'error'
				level = 'Connection Failure'
				break
			case 'crashed':
				category = 'error'
				level = 'Crashed'
				break
			case 'unknown_error':
				category = 'error'
				level = 'ERROR'
				break
			case 'bad_config':
				category = 'warning'
				level = 'Bad Configuration'
				break
			case 'unknown_warning':
				category = 'warning'
				level = 'Warning'
				break
			case 'initializing':
				category = 'warning'
				level = 'Initializing'
				break
			case 'authentication_failure':
				category = 'warning'
				level = 'Authentication Failure'
				break
			case 'system':
				category = 'error'
				break
			default:
				category = 'warning'
				break
		}

		const newStatuses = { ...this.#instanceStatuses }
		newStatuses[connectionId] = {
			category: category,
			level: level,
			message: msg?.toString?.(),
		}

		if (!isEqual(newStatuses[connectionId], this.#instanceStatuses[connectionId])) {
			this.#setStatuses(newStatuses)

			this.emit('status_change', newStatuses)

			this.#controls.checkAllStatus()
		}
	}

	/**
	 * Get the status of an instance
	 */
	getConnectionStatus(connectionId: string): ConnectionStatusEntry | undefined {
		return this.#instanceStatuses[connectionId]
	}

	/**
	 * Forget the status of an instance
	 */
	forgetConnectionStatus(connectionId: string): void {
		const newStatuses = { ...this.#instanceStatuses }
		delete newStatuses[connectionId]

		this.#setStatuses(newStatuses)

		this.emit('status_change', newStatuses)

		this.#controls.checkAllStatus()
	}

	/**
	 * Helper to update the statuses
	 */
	#setStatuses(newObj: Record<string, ConnectionStatusEntry>): void {
		const patch = jsonPatch.compare(this.#instanceStatuses || {}, newObj || {})
		if (patch.length > 0) {
			// TODO - make this be a subscription with a dedicated room
			this.#io.emitToAll(`connections:patch-statuses`, patch)
		}

		this.#instanceStatuses = newObj
	}
}
