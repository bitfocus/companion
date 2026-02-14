import mqtt from 'mqtt'
import LogController from '../Log/Controller.js'
import type { LinkMqttConfig } from '@companion-app/shared/Model/Link.js'
import { LinkTransport, type PublishOptions } from './Transport.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'

/**
 * MQTT 5.0 transport implementation for Companion Link.
 * Each instance represents a single connection to one MQTT broker.
 */
export class MqttTransport extends LinkTransport {
	readonly #logger = LogController.createLogger('Link/MqttTransport')

	#client: mqtt.MqttClient | null = null

	/** Set of topics currently subscribed to (for resubscription on reconnect) */
	readonly #subscribedTopics = new Set<string>()

	async connect(config: LinkMqttConfig): Promise<void> {
		if (this.#client) {
			await this.disconnect()
		}

		this.setStatus('connecting')
		this.#logger.info(`Connecting to MQTT broker: ${config.brokerUrl}`)

		const url = config.tls ? config.brokerUrl.replace(/^mqtt:/, 'mqtts:') : config.brokerUrl

		const client = mqtt.connect(url, {
			protocolVersion: 5,
			username: config.username || undefined,
			password: config.password || undefined,
			clean: true,
			reconnectPeriod: 5000,
			connectTimeout: 10000,
		})

		this.#client = client

		client.on('connect', () => {
			this.#logger.info('Connected to MQTT broker')
			this.setStatus('connected')

			// Resubscribe to all tracked topics on reconnect
			for (const topic of this.#subscribedTopics) {
				client.subscribe(topic, { qos: 1 }, (err: Error | null) => {
					if (err) {
						this.#logger.warn(`Failed to resubscribe to ${topic}: ${stringifyError(err)}`)
					}
				})
			}
		})

		client.on('reconnect', () => {
			this.#logger.debug('Reconnecting to MQTT broker...')
			this.setStatus('connecting')
		})

		client.on('error', (err: Error) => {
			this.#logger.error(`MQTT error: ${stringifyError(err)}`)
			this.setStatus('error', stringifyError(err))
		})

		client.on('offline', () => {
			this.#logger.debug('MQTT client offline')
			this.setStatus('disconnected')
		})

		client.on('close', () => {
			this.#logger.debug('MQTT connection closed')
			if (this.status !== 'error') {
				this.setStatus('disconnected')
			}
		})

		client.on('message', (topic: string, payload: Buffer) => {
			this.emit('message', topic, payload)
		})
	}

	async disconnect(): Promise<void> {
		const client = this.#client
		if (!client) return

		this.#client = null
		this.#subscribedTopics.clear()

		try {
			await client.endAsync(true)
		} catch (e) {
			this.#logger.warn(`Error disconnecting MQTT client: ${stringifyError(e)}`)
		}

		this.setStatus('disconnected')
		this.#logger.info('Disconnected from MQTT broker')
	}

	async publish(topic: string, payload: string | Buffer, options?: PublishOptions): Promise<void> {
		const client = this.#client
		if (!client?.connected) {
			this.#logger.debug(`Cannot publish to ${topic}: not connected`)
			return
		}

		await client.publishAsync(topic, payload, {
			qos: options?.qos ?? 1,
			retain: options?.retain ?? false,
		})
	}

	async subscribe(pattern: string): Promise<void> {
		this.#subscribedTopics.add(pattern)

		const client = this.#client
		if (!client?.connected) {
			// Will subscribe on connect via the resubscribe logic
			return
		}

		await client.subscribeAsync(pattern, { qos: 1 })
	}

	async unsubscribe(pattern: string): Promise<void> {
		this.#subscribedTopics.delete(pattern)

		const client = this.#client
		if (!client?.connected) return

		try {
			await client.unsubscribeAsync(pattern)
		} catch (e) {
			this.#logger.warn(`Error unsubscribing from ${pattern}: ${stringifyError(e)}`)
		}
	}
}
