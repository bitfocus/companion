import EventEmitter from 'node:events'
import LogController from '../Log/Controller.js'
import type { LinkTransportConfig, LinkTransportState, LinkTransportStatus } from '@companion-app/shared/Model/Link.js'
import type { LinkTransport, PublishOptions } from './Transport.js'
import { MqttTransport } from './MqttTransport.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'

/** A managed transport instance */
interface ManagedTransport {
	config: LinkTransportConfig
	transport: LinkTransport
}

export type TransportManagerEvents = {
	/** Emitted when a transport's status changes */
	transportStatusChanged: [states: LinkTransportState[]]
	/** Emitted when a message is received from any transport */
	message: [transportId: string, topic: string, payload: Buffer]
}

/**
 * Manages the lifecycle of multiple transport instances.
 * Routes outgoing messages to appropriate transports.
 * Aggregates incoming messages from all transports.
 */
export class TransportManager extends EventEmitter<TransportManagerEvents> {
	readonly #logger = LogController.createLogger('Link/TransportManager')

	/** Map of transport instance ID → ManagedTransport */
	readonly #transports = new Map<string, ManagedTransport>()

	/**
	 * Add or update a transport instance.
	 * If a transport with the same ID already exists, it will be disconnected and replaced.
	 */
	async addTransport(config: LinkTransportConfig): Promise<void> {
		// Tear down existing transport with same ID
		await this.removeTransport(config.id)

		const transport = this.#createTransport(config.type)

		const managed: ManagedTransport = { config, transport }
		this.#transports.set(config.id, managed)

		// Wire up events
		transport.on('statusChanged', (_status: LinkTransportStatus, _error: string | null) => {
			this.emit('transportStatusChanged', this.getTransportStates())
		})

		transport.on('message', (topic: string, payload: Buffer) => {
			this.emit('message', config.id, topic, payload)
		})

		// Connect if enabled
		if (config.enabled) {
			try {
				await transport.connect(config.config)
			} catch (e) {
				this.#logger.error(`Failed to connect transport ${config.id}: ${stringifyError(e)}`)
			}
		}

		this.emit('transportStatusChanged', this.getTransportStates())
	}

	/**
	 * Remove a transport instance.
	 */
	async removeTransport(id: string): Promise<void> {
		const managed = this.#transports.get(id)
		if (!managed) return

		this.#transports.delete(id)

		try {
			await managed.transport.disconnect()
		} catch (e) {
			this.#logger.warn(`Error disconnecting transport ${id}: ${stringifyError(e)}`)
		}

		managed.transport.removeAllListeners()
		this.emit('transportStatusChanged', this.getTransportStates())
	}

	/**
	 * Disconnect and remove all transports.
	 */
	async removeAll(): Promise<void> {
		const ids = [...this.#transports.keys()]
		await Promise.all(ids.map(async (id) => this.removeTransport(id)))
	}

	/**
	 * Publish a message to all connected transports.
	 * This is the initial "send over all" strategy.
	 */
	async publishToAll(topic: string, payload: string | Buffer, options?: PublishOptions): Promise<void> {
		const promises: Promise<void>[] = []
		for (const [, managed] of this.#transports) {
			if (managed.transport.status === 'connected') {
				promises.push(
					managed.transport.publish(topic, payload, options).catch((e) => {
						this.#logger.warn(`Failed to publish to transport ${managed.config.id}: ${stringifyError(e)}`)
					})
				)
			}
		}
		await Promise.all(promises)
	}

	/**
	 * Subscribe to a topic pattern on all transports.
	 */
	async subscribeAll(pattern: string): Promise<void> {
		const promises: Promise<void>[] = []
		for (const [, managed] of this.#transports) {
			promises.push(
				managed.transport.subscribe(pattern).catch((e) => {
					this.#logger.warn(`Failed to subscribe on transport ${managed.config.id}: ${stringifyError(e)}`)
				})
			)
		}
		await Promise.all(promises)
	}

	/**
	 * Unsubscribe from a topic pattern on all transports.
	 */
	async unsubscribeAll(pattern: string): Promise<void> {
		const promises: Promise<void>[] = []
		for (const [, managed] of this.#transports) {
			promises.push(
				managed.transport.unsubscribe(pattern).catch((e) => {
					this.#logger.warn(`Failed to unsubscribe on transport ${managed.config.id}: ${stringifyError(e)}`)
				})
			)
		}
		await Promise.all(promises)
	}

	/** Get the current states of all transports for the UI */
	getTransportStates(): LinkTransportState[] {
		const states: LinkTransportState[] = []
		for (const [id, managed] of this.#transports) {
			states.push({
				id,
				status: managed.transport.status,
				error: managed.transport.error,
			})
		}
		return states
	}

	/** Get the set of transport IDs that are currently connected */
	getConnectedTransportIds(): string[] {
		const ids: string[] = []
		for (const [id, managed] of this.#transports) {
			if (managed.transport.status === 'connected') {
				ids.push(id)
			}
		}
		return ids
	}

	/** Create a concrete transport instance based on type */
	#createTransport(type: LinkTransportConfig['type']): LinkTransport {
		switch (type) {
			case 'mqtt':
				return new MqttTransport()
			default:
				throw new Error(`Unknown transport type: ${type}`)
		}
	}
}
