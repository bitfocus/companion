import EventEmitter from 'node:events'
import type { LinkTransportStatus, LinkTransportTypeConfig } from '@companion-app/shared/Model/Link.js'

/** Options for publishing a message */
export interface PublishOptions {
	/** QoS level (0, 1, or 2) */
	qos?: 0 | 1 | 2
	/** Whether to retain the message on the broker */
	retain?: boolean
}

/** Handler for incoming messages on a subscribed topic */
export type MessageHandler = (topic: string, payload: Buffer) => void

/** Events emitted by a LinkTransport */
export type LinkTransportEvents = {
	/** Connection status changed */
	statusChanged: [status: LinkTransportStatus, error: string | null]
	/** A message was received on a subscribed topic */
	message: [topic: string, payload: Buffer]
}

/**
 * Abstract transport interface for Companion Link.
 * Each transport instance represents a single logical connection.
 * Concrete implementations (MQTT, WebRTC, etc.) extend this class.
 */
export abstract class LinkTransport extends EventEmitter<LinkTransportEvents> {
	/** Current connection status */
	status: LinkTransportStatus = 'disconnected'

	/** Current error message, if any */
	error: string | null = null

	constructor() {
		super()
		this.setMaxListeners(0)
	}

	/** Connect to the transport backend */
	abstract connect(config: LinkTransportTypeConfig): Promise<void>

	/** Disconnect from the transport backend */
	abstract disconnect(): Promise<void>

	/** Publish a message to a topic */
	abstract publish(topic: string, payload: string | Buffer, options?: PublishOptions): Promise<void>

	/** Subscribe to a topic pattern */
	abstract subscribe(pattern: string): Promise<void>

	/** Unsubscribe from a topic pattern */
	abstract unsubscribe(pattern: string): Promise<void>

	/** Update the status and emit an event */
	protected setStatus(status: LinkTransportStatus, error: string | null = null): void {
		this.status = status
		this.error = error
		this.emit('statusChanged', status, error)
	}
}
