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
	readonly #instanceStatuses: Record<string, ConnectionStatusEntry> = {}

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

		const oldStatusForConnection: ConnectionStatusEntry | undefined = this.#instanceStatuses[connectionId]
		const newStatusForConnection: ConnectionStatusEntry = {
			category: category,
			level: level,
			message: msg?.toString?.(),
		}
		this.#instanceStatuses[connectionId] = newStatusForConnection

		if (!oldStatusForConnection || !isEqual(oldStatusForConnection, newStatusForConnection)) {
			this.#io.emitToAll(`connections:update-statuses`, [
				{
					type: 'update',
					connectionId: connectionId,
					status: newStatusForConnection,
				},
			])

			this.emit('status_change', this.#instanceStatuses)

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
		delete this.#instanceStatuses[connectionId]

		this.#io.emitToAll(`connections:update-statuses`, [
			{
				type: 'remove',
				connectionId: connectionId,
			},
		])

		this.emit('status_change', this.#instanceStatuses)

		this.#controls.checkAllStatus()
	}
}
