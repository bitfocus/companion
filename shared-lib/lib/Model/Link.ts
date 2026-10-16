import type { JsonValue } from 'type-fest'
import type {
	CompanionInputFieldCheckboxExtended,
	CompanionInputFieldDropdownExtended,
	CompanionInputFieldNumberExtended,
	CompanionInputFieldSecretExtended,
	CompanionInputFieldStaticTextExtended,
	CompanionInputFieldTextInputExtended,
} from './Options.js'

/**
 * Companion Link: linking Companion installations together, over one or more transports.
 * These types are shared between the backend and the UI.
 */

/**
 * What an installation lets another one use. Each installation decides this for itself, per connection (eg per
 * paired installation on a direct connection, or for everyone on an MQTT broker).
 * For now this is all or nothing per kind of thing; it will grow (eg which pages, variables).
 */
export interface LinkPermissions {
	/** Whether the other installation may see and press the buttons of this one */
	buttons: boolean
}

export type LinkPermission = keyof LinkPermissions

/** Nothing is shared until the user says so */
export const LINK_NO_PERMISSIONS: Readonly<LinkPermissions> = { buttons: false }

/**
 * A config field of a transport. The UI renders the transport config editor from these. Plain values only: a
 * transport config has nothing to evaluate variables or expressions against
 */
export type LinkTransportConfigField =
	| CompanionInputFieldStaticTextExtended
	| Omit<CompanionInputFieldTextInputExtended, 'useVariables'>
	| CompanionInputFieldSecretExtended
	| CompanionInputFieldNumberExtended
	| CompanionInputFieldCheckboxExtended
	| CompanionInputFieldDropdownExtended

/** A kind of transport, as described by the backend so that the UI can be built from it */
export interface ClientLinkTransportType {
	/** Unique id of the transport type, stored in each transport config */
	type: string
	/** Short name, eg 'MQTT broker' */
	name: string
	/** One or two sentences, shown when choosing a transport to add */
	description: string
	/** The fields of the transport config */
	configFields: LinkTransportConfigField[]
}

/** A configured transport */
export interface LinkTransportConfig {
	id: string
	/** The ClientLinkTransportType['type'] of this transport */
	type: string
	label: string
	enabled: boolean
	/** Values of the transport type's config fields */
	config: Record<string, JsonValue | undefined>
	sortOrder: number
}

export type LinkTransportStatus = 'disabled' | 'connecting' | 'connected' | 'error'

/** A read-only fact a transport reports about itself, eg the address it is listening on */
export interface LinkTransportInfoItem {
	label: string
	value: string
	/** Show a copy button next to the value, for things the user will need to enter on another installation */
	copyable?: boolean
}

/** Something the user can do to an entry reported by a transport */
export interface LinkTransportSectionAction {
	id: string
	label: string
	color: 'primary' | 'secondary' | 'danger'
}

/** An item reported by a transport, that the user may act on, eg a pairing request */
export interface LinkTransportEntry {
	id: string
	title: string
	description: string | null
	/** When set, the user is asked for a value (eg a pairing code), which is passed with the action */
	inputLabel: string | null
	actions: LinkTransportSectionAction[]
}

/** A group of entries reported by a transport, eg the installations paired with it */
export interface LinkTransportSection {
	id: string
	title: string
	description: string | null
	/** Whether the section needs the user's attention, eg there is a pairing request waiting */
	attention: boolean
	entries: LinkTransportEntry[]
}

/** The runtime state of a configured transport */
export interface LinkTransportState {
	status: LinkTransportStatus
	/** Explanation of the status, eg the error */
	message: string | null
	info: LinkTransportInfoItem[]
	sections: LinkTransportSection[]
}

export type LinkTransportsUpdate =
	| { type: 'init'; items: Record<string, LinkTransportConfig> }
	| { type: 'add'; itemId: string; info: LinkTransportConfig }
	| { type: 'remove'; itemId: string }

export type LinkTransportStatesUpdate =
	| { type: 'init'; items: Record<string, LinkTransportState> }
	| { type: 'update'; itemId: string; state: LinkTransportState }
	| { type: 'remove'; itemId: string }

/** How a peer is reachable on one transport */
export interface LinkPeerRoute {
	transportId: string
	/** The last measured round trip time over this transport, or null until one has been */
	latencyMs: number | null
}

/** A Companion installation discovered on at least one transport */
export interface LinkPeerInfo {
	id: string
	name: string
	companionVersion: string
	/** The Link protocol versions the peer speaks, one per major version */
	protocolVersions: string[]
	/** The peer's version of the highest major version both speak, or null if there is none */
	protocolVersion: string | null
	/** Whether we share a protocol major version. Incompatible peers are listed but can't be used */
	compatible: boolean
	/** The transports the peer is currently reachable on */
	routes: LinkPeerRoute[]
	/** Whether the peer is reachable on any transport */
	online: boolean
	/** Unix timestamp (ms) of the last announcement received */
	lastSeen: number
	/**
	 * What this installation lets the peer use, over the transports it is reachable on (shared if shared over any
	 * of them). Decided by each transport, eg per paired installation
	 */
	sharedByUs: LinkPermissions
	/** What the peer lets this installation use, or null until it has said */
	sharedWithUs: LinkPermissions | null
}

/** Information about this installation, as seen by peers */
export interface LinkSelfInfo {
	id: string
	name: string
	/** The Link protocol versions this installation speaks, one per major version */
	protocolVersions: string[]
}

/**
 * Why a link button is showing what it is showing
 * - `unconfigured`: no peer or location chosen, or the location could not be resolved
 * - `unknown_peer`: the peer has not been discovered on any transport
 * - `incompatible`: the peer speaks an incompatible protocol version
 * - `offline`: the peer is known but not currently reachable
 * - `denied`: the peer does not share its buttons with this installation
 * - `loading`: subscribed, waiting for the first image
 * - `loop`: the remote button is (indirectly) linked back to this installation
 * - `ok`: showing the remote button
 */
export type LinkButtonStatus =
	'unconfigured' | 'unknown_peer' | 'incompatible' | 'offline' | 'denied' | 'loading' | 'loop' | 'ok'

/** Runtime (non-persisted) state of a link button, for the button editor */
export interface LinkButtonRuntimeProps {
	status: LinkButtonStatus
	/** Name of the target peer, when it is known */
	peerName: string | null
}
