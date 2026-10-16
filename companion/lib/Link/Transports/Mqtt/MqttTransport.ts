import mqtt from 'mqtt'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { LinkPublishOptions, LinkTransport, LinkTransportContext } from '../Types.js'

export type MqttTransportConfig = {
	url: string
	username: string
	password: string
	allowUntrustedCertificate: boolean
}

/**
 * A connection to one MQTT broker. MQTT is publish/subscribe with topics already, so this is a thin wrapper.
 * The broker handles retained messages and the last will for us.
 */
export class MqttTransport implements LinkTransport {
	readonly #context: LinkTransportContext
	readonly #client: mqtt.MqttClient

	/** Subscriptions to restore after a reconnect where the broker lost our session */
	readonly #subscriptions = new Set<string>()

	constructor(context: LinkTransportContext, config: MqttTransportConfig) {
		this.#context = context

		context.setStatus('connecting', null)
		context.setInfo([{ label: 'Broker', value: config.url }])

		this.#client = mqtt.connect(config.url, {
			protocolVersion: 5,
			username: config.username || undefined,
			password: config.password || undefined,
			clientId: `companion-link-${context.peerId}-${Math.random().toString(16).slice(2, 8)}`,
			clean: true,
			reconnectPeriod: 1000,
			connectTimeout: 10000,
			rejectUnauthorized: !config.allowUntrustedCertificate,
			will: {
				topic: context.lastWill.topic,
				payload: Buffer.from(context.lastWill.payload),
				qos: 1,
				retain: context.lastWill.retain,
			},
		})

		this.#client.on('connect', (packet) => {
			context.logger.info(`Connected to ${config.url}`)
			context.setStatus('connected', null)

			// With a clean session the broker forgets our subscriptions on every reconnect
			if (!packet.sessionPresent) {
				for (const pattern of this.#subscriptions) this.#doSubscribe(pattern)
			}
		})
		this.#client.on('reconnect', () => context.setStatus('connecting', null))
		this.#client.on('offline', () => context.setStatus('connecting', 'Broker unreachable, retrying'))
		this.#client.on('error', (err) => {
			context.logger.warn(`MQTT error: ${stringifyError(err)}`)
			context.setStatus('error', stringifyError(err))
		})
		this.#client.on('message', (topic, payload) => context.receive(topic, payload.toString('utf8')))
	}

	publish(topic: string, payload: string, options: LinkPublishOptions): void {
		if (!this.#client.connected) return

		this.#client.publish(topic, payload, { qos: 1, retain: options.retain }, (err) => {
			if (err) this.#context.logger.warn(`Failed to publish to ${topic}: ${stringifyError(err)}`)
		})
	}

	subscribe(pattern: string): void {
		this.#subscriptions.add(pattern)
		// When not connected, this happens on connect instead
		if (this.#client.connected) this.#doSubscribe(pattern)
	}

	unsubscribe(pattern: string): void {
		this.#subscriptions.delete(pattern)
		if (!this.#client.connected) return

		this.#client.unsubscribe(pattern, (err) => {
			if (err) this.#context.logger.warn(`Failed to unsubscribe from ${pattern}: ${stringifyError(err)}`)
		})
	}

	#doSubscribe(pattern: string): void {
		this.#client.subscribe(pattern, { qos: 1 }, (err) => {
			if (err) this.#context.logger.warn(`Failed to subscribe to ${pattern}: ${stringifyError(err)}`)
		})
	}

	async handleAction(_entryId: string, _actionId: string, _input: string | null): Promise<string | null> {
		return 'Unknown action'
	}

	async destroy(): Promise<void> {
		this.#subscriptions.clear()
		// Force when not connected, as there is nothing to flush and it would otherwise wait for a connection
		await this.#client.endAsync(!this.#client.connected)
	}
}
