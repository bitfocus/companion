import { isEqual } from 'lodash-es'
// import LogController from '../Log/Controller.js'
import { EventEmitter } from 'events'
import type { InstanceStatusEntry, InstanceStatusUpdate } from '@companion-app/shared/Model/InstanceStatus.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'

export interface InstanceStatusEvents {
	status_change: [statuses: Record<string, InstanceStatusEntry>]
	uiChange: [change: InstanceStatusUpdate]
}

export class InstanceStatus extends EventEmitter<InstanceStatusEvents> {
	/**
	 * The latest statuses object
	 * levels: null = unknown, see updateInstanceStatus for possible values
	 */
	readonly #instanceStatuses: Record<string, InstanceStatusEntry> = {}

	// readonly #logger = LogController.createLogger('Instance/Status')

	createTrpcRouter() {
		const self = this
		const selfEvents: EventEmitter<InstanceStatusEvents> = this
		return router({
			watch: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(selfEvents, 'uiChange', signal)

				yield { type: 'init', statuses: self.#instanceStatuses } satisfies InstanceStatusUpdate

				for await (const [change] of changes) {
					yield change
				}
			}),
		})
	}

	/**
	 * Update the status of an instance
	 */
	updateInstanceStatus(instanceId: string, level: string | null, msg: string | null): void {
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

		const oldStatusForInstance: InstanceStatusEntry | undefined = this.#instanceStatuses[instanceId]
		const newStatusForInstance: InstanceStatusEntry = {
			category: category,
			level: level,
			message: msg?.toString?.() ?? null,
		}
		this.#instanceStatuses[instanceId] = newStatusForInstance

		if (!oldStatusForInstance || !isEqual(oldStatusForInstance, newStatusForInstance)) {
			this.emit('uiChange', {
				type: 'update',
				instanceId: instanceId,
				status: newStatusForInstance,
			})

			this.emit('status_change', this.#instanceStatuses)
		}
	}

	/**
	 * Get the status of an instance
	 */
	getInstanceStatus(instanceId: string): InstanceStatusEntry | undefined {
		return this.#instanceStatuses[instanceId]
	}

	/**
	 * Forget the status of an instance
	 */
	forgetInstanceStatus(instanceId: string): void {
		delete this.#instanceStatuses[instanceId]

		this.emit('uiChange', {
			type: 'remove',
			instanceId: instanceId,
		})

		this.emit('status_change', this.#instanceStatuses)
	}
}
