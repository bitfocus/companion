import type { JsonValue } from 'type-fest'
import type {
	LinkPermission,
	LinkPermissions,
	LinkTransportConfigField,
	LinkTransportInfoItem,
	LinkTransportSection,
	LinkTransportStatus,
} from '@companion-app/shared/Model/Link.js'
import type { Logger } from '../../Log/Controller.js'

/**
 * The contract between the Link core and a transport. See README.md in this folder for a guide to writing one.
 *
 * A transport moves opaque string payloads between installations using publish/subscribe on MQTT style topics.
 * It knows nothing about the Link protocol itself.
 */

/** A message the transport should arrange to be delivered to peers if this installation disappears unexpectedly */
export interface LinkTransportLastWill {
	topic: string
	payload: string
	retain: boolean
}

/**
 * Where a received message came from, as far as the transport can tell. The transport is what authenticates (or
 * doesn't) the other end, so it decides what each connection may use
 */
export interface LinkMessageOrigin {
	/**
	 * Identifies the connection within the transport, eg the key of a paired installation. A transport that can't
	 * tell its peers apart (eg a broker) uses one id for everything
	 */
	connectionId: string
	/** What this installation lets that connection use */
	permissions: LinkPermissions
}

/** What the Link core provides to a transport instance */
export interface LinkTransportContext {
	readonly logger: Logger
	/** The Link id of this installation */
	readonly peerId: string
	/** The name of this installation, as shown to the user. It can change while the transport runs */
	getName(): string
	/** Published (retained) by the transport on our behalf if we vanish without saying goodbye */
	readonly lastWill: LinkTransportLastWill
	/**
	 * Persistent key-value storage for this transport instance, for state that is not user config (eg a
	 * generated certificate). Cleared when the transport is deleted
	 */
	readonly storage: LinkTransportStorage

	/** Hand a message that arrived on a subscribed topic to the Link core, saying where it came from */
	receive(topic: string, payload: string, origin: LinkMessageOrigin): void
	/**
	 * What a connection may use has changed (eg the user stopped sharing buttons with a paired installation). The
	 * core tells the peers on it, and drops anything they are no longer allowed
	 */
	setConnectionPermissions(connectionId: string, permissions: LinkPermissions): void
	/** Report the connection status, with an explanation (eg the error) */
	setStatus(status: LinkTransportStatus, message: string | null): void
	/** Report facts to show to the user, eg the address being listened on */
	setInfo(info: LinkTransportInfoItem[]): void
	/**
	 * Report things the user can act on, eg pairing requests. Actions on the entries arrive at
	 * {@link LinkTransport.handleAction}
	 */
	setSections(sections: LinkTransportSection[]): void
}

export interface LinkTransportStorage {
	get(key: string): JsonValue | undefined
	set(key: string, value: JsonValue): void
}

export interface LinkPublishOptions {
	/** Whether the broker should keep this as the last value of the topic, for subscribers that arrive later */
	retain: boolean
	/**
	 * Only deliver to connections that have this permission, eg button images need `buttons`. A transport that can't
	 * tell its peers apart drops the message unless everyone has it
	 */
	requires: LinkPermission | null
}

/**
 * A running transport instance. A new instance is created whenever the config changes, so it does not need to
 * handle reconfiguration.
 */
export interface LinkTransport {
	/**
	 * Publish a message. Fire and forget: if the transport is not connected, the message is dropped.
	 * An empty retained payload clears the retained value of the topic
	 */
	publish(topic: string, payload: string, options: LinkPublishOptions): void
	/**
	 * Start receiving messages on topics matching a pattern. Subscriptions must survive reconnects.
	 * The core never subscribes to the same pattern twice without unsubscribing in between
	 */
	subscribe(pattern: string): void
	/** Stop receiving messages on a pattern previously subscribed to */
	unsubscribe(pattern: string): void
	/**
	 * The user chose an action on an entry reported with `setSections`
	 * @param input - the value the user entered, when the entry asked for one
	 * @returns an error to show the user, or null on success
	 */
	handleAction(entryId: string, actionId: string, input: string | null): Promise<string | null>
	/** Disconnect and release all resources. Should publish nothing; the core says goodbye before calling this */
	destroy(): Promise<void>
}

/**
 * Describes a type of transport. Everything the UI shows about the transport type comes from here.
 * @template TConfig - the shape of the config, matching `configFields`
 */
export interface LinkTransportDefinition<TConfig extends Record<string, JsonValue | undefined>> {
	/** Unique id, persisted in the config. Must never change */
	readonly type: string
	readonly name: string
	readonly description: string
	/**
	 * Fields of the config. Values are validated and sanitised against these, with defaults filled in, before
	 * they reach `create`
	 */
	readonly configFields: LinkTransportConfigField[]

	create(context: LinkTransportContext, config: TConfig): LinkTransport
}

export type SomeLinkTransportDefinition = LinkTransportDefinition<any>
