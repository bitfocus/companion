import mqtt from 'mqtt'
import { z } from 'zod'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { LinkIdentity } from '../../Identity.js'
import type { LinkPublishOptions, LinkTransport, LinkTransportContext } from '../Types.js'

export type MqttTransportConfig = {
	url: string
	username: string
	password: string
	topicPrefix: string
	allowUntrustedCertificate: boolean
}

/**
 * What goes over the broker: the Link payload, who sent it (as the broker can't say), and their signature of it,
 * proving that. An empty payload is sent as is, as that is how a retained message is cleared
 */
const MqttEnvelopeSchema = z.object({
	/** The Link id of the sender */
	from: z.string().min(1).max(64),
	payload: z.string(),
	/** The sender's signature of the Link topic and payload (base64), so that it can't be replayed on another topic */
	signature: z.string().max(200),
})
type MqttEnvelope = z.infer<typeof MqttEnvelopeSchema>

/**
 * A connection to one MQTT broker. MQTT is publish/subscribe with topics already, so this is a thin wrapper.
 * The broker handles retained messages and the last will for us.
 */
export class MqttTransport implements LinkTransport {
	readonly #context: LinkTransportContext
	readonly #client: mqtt.MqttClient
	/** Put in front of every Link topic, to keep them apart from anything else on the broker */
	readonly #topicPrefix: string

	/** Subscriptions to restore after a reconnect where the broker lost our session */
	readonly #subscriptions = new Set<string>()

	constructor(context: LinkTransportContext, config: MqttTransportConfig) {
		this.#context = context
		this.#topicPrefix = `${config.topicPrefix.replace(/\/+$/, '')}/`

		context.setStatus('connecting', null)
		context.setInfo([{ label: 'Broker', value: config.url }])

		this.#client = mqtt.connect(config.url, {
			// 3.1.1 has everything needed (last will, retain, QoS), and every broker supports it
			protocolVersion: 4,
			username: config.username || undefined,
			password: config.password || undefined,
			clientId: `companion-link-${context.identity.id}-${Math.random().toString(16).slice(2, 8)}`,
			clean: true,
			reconnectPeriod: 1000,
			connectTimeout: 10000,
			rejectUnauthorized: !config.allowUntrustedCertificate,
			will: {
				topic: this.#topicPrefix + context.lastWill.topic,
				payload: Buffer.from(this.#wrap(context.lastWill.topic, context.lastWill.payload)),
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
		this.#client.on('message', (topic, raw) => {
			if (!topic.startsWith(this.#topicPrefix)) return
			const linkTopic = topic.slice(this.#topicPrefix.length)

			const envelope = unwrap(linkTopic, raw.toString('utf8'))
			if (!envelope) {
				context.logger.debug(`Ignoring an invalid or unsigned message on ${topic}`)
				return
			}
			context.receive(linkTopic, envelope.payload, {
				// Proven by the signature
				peerId: envelope.from,
			})
		})
	}

	publish(topic: string, payload: string, options: LinkPublishOptions): void {
		if (!this.#client.connected) return
		// A broker can't limit who receives what, so `options.requires` can't be honoured: anyone who can subscribe on
		// the broker can read it. Peers are only sent what they ask for and are allowed, so this is only a leak to
		// others on the same broker

		this.#client.publish(
			this.#topicPrefix + topic,
			this.#wrap(topic, payload),
			{ qos: 1, retain: options.retain },
			(err) => {
				if (err) this.#context.logger.warn(`Failed to publish to ${topic}: ${stringifyError(err)}`)
			}
		)
	}

	subscribe(pattern: string): void {
		this.#subscriptions.add(pattern)
		// When not connected, this happens on connect instead
		if (this.#client.connected) this.#doSubscribe(pattern)
	}

	unsubscribe(pattern: string): void {
		this.#subscriptions.delete(pattern)
		if (!this.#client.connected) return

		this.#client.unsubscribe(this.#topicPrefix + pattern, (err) => {
			if (err) this.#context.logger.warn(`Failed to unsubscribe from ${pattern}: ${stringifyError(err)}`)
		})
	}

	#wrap(linkTopic: string, payload: string): string {
		if (payload === '') return ''
		const identity = this.#context.identity
		return JSON.stringify({
			from: identity.id,
			payload,
			signature: identity.sign(signedData(linkTopic, payload)).toString('base64'),
		} satisfies MqttEnvelope)
	}

	#doSubscribe(pattern: string): void {
		this.#client.subscribe(this.#topicPrefix + pattern, { qos: 1 }, (err) => {
			if (err) this.#context.logger.warn(`Failed to subscribe to ${pattern}: ${stringifyError(err)}`)
		})
	}

	async handleSectionAction(_entryId: string, _actionId: string, _input: string | null): Promise<string | null> {
		return 'Unknown action'
	}

	async destroy(): Promise<void> {
		this.#subscriptions.clear()
		// Force when not connected, as there is nothing to flush and it would otherwise wait for a connection
		await this.#client.endAsync(!this.#client.connected)
	}
}

/** What is signed: the Link topic (without the prefix, which can differ) and the payload */
function signedData(linkTopic: string, payload: string): Buffer {
	return Buffer.from(`companion-link-mqtt\0${linkTopic}\0${payload}`)
}

/**
 * @returns the sender and payload, with no sender for an empty (clearing) message, or null if it is invalid or the
 * signature doesn't match
 */
function unwrap(linkTopic: string, raw: string): { from: string | null; payload: string } | null {
	if (raw === '') return { from: null, payload: '' }
	try {
		const parsed = MqttEnvelopeSchema.safeParse(JSON.parse(raw))
		if (!parsed.success) return null
		const { from, payload, signature } = parsed.data
		if (!LinkIdentity.verify(from, signedData(linkTopic, payload), Buffer.from(signature, 'base64'))) return null
		return { from, payload }
	} catch {
		return null
	}
}
