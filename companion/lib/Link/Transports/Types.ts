import type { JsonValue } from 'type-fest'
import type { BonjourQuery } from '@companion-app/shared/Model/Common.js'
import type {
	LinkTransportConfigField,
	LinkTransportInfoItem,
	LinkTransportSection,
	LinkTransportStatus,
} from '@companion-app/shared/Model/Link.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import type { DataUserConfig } from '../../Data/UserConfig.js'
import type { Logger } from '../../Log/Controller.js'
import type { LinkIdentity } from '../Identity.js'

/**
 * The contract between the Link core and a transport. See README.md in this folder for a guide to writing one.
 *
 * A transport moves opaque string payloads between installations: it makes this installation's announcement known
 * to the others it can reach, and sends messages to one installation at a time. It knows nothing about the Link
 * protocol itself.
 */

/** Where a received message came from */
export interface LinkMessageOrigin {
	/**
	 * The Link id of the installation that sent it, as established by the transport: eg proven by the handshake of a
	 * direct connection, or by a signature in a broker transport's own envelope. Messages don't carry it themselves
	 */
	peerId: string
}

/** What the Link core provides to a transport instance */
export interface LinkTransportContext {
	readonly logger: Logger
	/**
	 * The identity of this installation. Its `id` is the Link id; use it to prove who is sending (eg by signing, or in
	 * an authenticated handshake)
	 */
	readonly identity: LinkIdentity
	/** The name of this installation, as shown to the user. It can change while the transport runs */
	getName(): string
	/**
	 * Persistent key-value storage for this transport instance, for state that is not user config (eg a
	 * generated certificate). Cleared when the transport is deleted
	 */
	readonly storage: LinkTransportStorage

	/**
	 * Hand the announcement of another installation to the Link core, or null when it has gone (it said goodbye, or
	 * the transport can tell it has disappeared, eg its connection closed). The id must be established as for
	 * {@link LinkMessageOrigin}
	 */
	receiveAnnouncement(peerId: string, payload: string | null): void
	/** Hand a message sent to this installation to the Link core, saying who sent it */
	receive(payload: string, origin: LinkMessageOrigin): void
	/** Report the connection status, with an explanation (eg the error) */
	setStatus(status: LinkTransportStatus, message: string | null): void
	/** Report facts to show to the user, eg the address being listened on */
	setInfo(info: LinkTransportInfoItem[]): void
	/**
	 * Report things the user can act on, eg pairing requests. Actions on the entries arrive at
	 * {@link LinkTransport.handleSectionAction}
	 */
	setSections(sections: LinkTransportSection[]): void
}

export interface LinkTransportStorage {
	get(key: string): JsonValue | undefined
	set(key: string, value: JsonValue): void
}

/**
 * A running transport instance. A new instance is created whenever the config changes, so it does not need to
 * handle reconfiguration.
 */
export interface LinkTransport {
	/**
	 * Make this installation's announcement known to every installation reachable on this transport, including any
	 * that become reachable later, until it is replaced. Null withdraws it, telling them this installation has gone
	 */
	announce(payload: string | null): void
	/** Send a message to one installation. Fire and forget: if it can't be reached, the message is dropped */
	send(peerId: string, payload: string): void
	/**
	 * The user chose an action on an entry reported with `setSections`, eg "Pair". Unrelated to the actions of buttons
	 * @param input - the value the user entered, when the entry asked for one
	 * @returns an error to show the user, or null on success
	 */
	handleSectionAction(entryId: string, actionId: string, input: string | null): Promise<string | null>
	/** Disconnect and release all resources. Should send nothing; the core says goodbye before calling this */
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
	/** The services each `bonjour-device` field discovers, by field id */
	readonly bonjourQueries?: Readonly<Record<string, BonjourQuery>>

	create(context: LinkTransportContext, config: TConfig): LinkTransport
}

export type SomeLinkTransportDefinition = LinkTransportDefinition<any>

/**
 * A transport that is part of Link rather than added by the user: there is always exactly one of it, switched on and
 * configured in the settings like Companion's other protocols (eg accepting direct connections)
 */
export interface LinkBuiltinTransport<TConfig extends Record<string, JsonValue | undefined>> {
	/** The fixed id of its instance, which keeps its storage across restarts */
	readonly id: string
	readonly definition: LinkTransportDefinition<TConfig>
	/** The user config keys `getConfig` reads, so that it is restarted when one of them changes */
	readonly userConfigKeys: readonly (keyof UserConfigModel)[]
	/** Its config, from the user config, or null when it is switched off */
	getConfig(userconfig: DataUserConfig): TConfig | null
}

export type SomeLinkBuiltinTransport = LinkBuiltinTransport<any>
