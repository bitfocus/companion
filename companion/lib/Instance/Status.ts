import { isEqual } from 'lodash-es'
// import LogController from '../Log/Controller.js'
import { EventEmitter } from 'events'
import type { ConnectionStatusEntry, ConnectionStatusUpdate } from '@companion-app/shared/Model/Common.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'

export interface InstanceStatusEvents {
	status_change: [statuses: Record<string, ConnectionStatusEntry>]
	uiChange: [change: ConnectionStatusUpdate]
}

export class InstanceStatus extends EventEmitter<InstanceStatusEvents> {
	/**
	 * The latest statuses object
	 * levels: null = unknown, see updateInstanceStatus for possible values
	 */
	readonly #instanceStatuses: Record<string, ConnectionStatusEntry> = {}

	// readonly #logger = LogController.createLogger('Instance/Status')

	createTrpcRouter() {
		const self = this
		const selfEvents: EventEmitter<InstanceStatusEvents> = this
		return router({
			watch: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(selfEvents, 'uiChange', signal)

				yield { type: 'init', statuses: self.#instanceStatuses } satisfies ConnectionStatusUpdate

				for await (const [change] of changes) {
					yield change
				}
			}),
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
			message: msg?.toString?.() ?? null,
		}
		this.#instanceStatuses[connectionId] = newStatusForConnection

		if (!oldStatusForConnection || !isEqual(oldStatusForConnection, newStatusForConnection)) {
			this.emit('uiChange', {
				type: 'update',
				connectionId: connectionId,
				status: newStatusForConnection,
			})

			this.emit('status_change', this.#instanceStatuses)
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

		this.emit('uiChange', {
			type: 'remove',
			connectionId: connectionId,
		})

		this.emit('status_change', this.#instanceStatuses)
	}
}
