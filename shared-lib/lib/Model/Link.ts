import type { JsonValue } from 'type-fest'
import type {
	CompanionInputFieldBonjourDeviceExtended,
	CompanionInputFieldCheckboxExtended,
	CompanionInputFieldDropdownExtended,
	CompanionInputFieldNumberExtended,
	CompanionInputFieldSecretExtended,
	CompanionInputFieldStaticTextExtended,
	CompanionInputFieldTextInputExtended,
} from './Options.js'
import type { UserConfigGridSize } from './UserConfigModel.js'

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

/** The things that can be shared with another installation, in the order they are shown */
export const LINK_PERMISSION_DEFINITIONS: readonly { id: LinkPermission; label: string; description: string }[] = [
	{ id: 'buttons', label: 'Buttons', description: 'Show and press the buttons of the other installation' },
]

/**
 * A config field of a transport. The UI renders the transport config editor from these. Plain values only: a
 * transport config has nothing to evaluate variables or expressions against
 */
export type LinkTransportConfigField =
	| CompanionInputFieldBonjourDeviceExtended
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
	/**
	 * Whether it is part of Link rather than added by the user: there is one of it, switched on and configured in
	 * Settings, under Protocols
	 */
	builtin: boolean
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
	/**
	 * Whether this is the instance of a transport that is part of Link, which is configured in Settings, under
	 * Protocols, rather than here
	 */
	builtin: boolean
}

export type LinkTransportStatus = 'disabled' | 'connecting' | 'connected' | 'error'

/** A read-only fact a transport reports about itself, eg the address it is listening on */
export interface LinkTransportInfoItem {
	label: string
	value: string
	/** Show a copy button next to the value, for things the user will need to enter on another installation */
	copyable?: boolean
	/** When the value is another installation, its Link id, so that the UI can link to it */
	peerId?: string
}

/** Something the user can do to an entry reported by a transport */
export interface LinkTransportSectionAction {
	id: string
	label: string
	color: 'primary' | 'secondary' | 'danger'
	/**
	 * Whether it needs the value the entry asks for (see inputLabel), so can't be done without one. It is done when
	 * the value is submitted, eg with Enter. Defaults to false
	 */
	requiresInput?: boolean
}

/** An item reported by a transport, that the user may act on, eg a pairing request */
export interface LinkTransportEntry {
	id: string
	title: string
	description: string | null
	/** When set, the user is asked for a value (eg a pairing code), which is passed with the action */
	inputLabel: string | null
	/** When the entry is another installation, its Link id, so that the UI can link to it */
	peerId?: string
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
	/** A short, readable form of the id, for the user to recognise it by */
	fingerprint: string
	/** What to call it: the name given to it here, or else the one it announces */
	name: string
	/** The name it announces, which is its own name for itself */
	announcedName: string
	/** The name given to it here, or null to use the one it announces */
	alias: string | null
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

/** How much of what is shared is in use, in each direction, eg the buttons subscribed to (once per button and size) */
export interface LinkUsage {
	/** Of what we share with it, how much it is using */
	oursUsedThere: number
	/** Of what it shares with us, how much is in use here */
	theirsUsedHere: number
}

/** How much two installations are using of each other, for each thing that can be shared */
export type LinkPeerUsage = Record<LinkPermission, LinkUsage>

/** Information about this installation, as seen by peers */
export interface LinkSelfInfo {
	id: string
	/** A short, readable form of the id, as shown to the user here and on other installations */
	fingerprint: string
	name: string
	/** The Link protocol versions this installation speaks, one per major version */
	protocolVersions: string[]
}

/** A page of buttons of another installation, to choose a remote button from */
export interface LinkRemotePage {
	pageNumber: number
	/** May be empty */
	name: string
	/** Where on the page there are buttons */
	buttons: { row: number; column: number }[]
}

/** The pages of buttons of another installation, or why they can't be had */
export type LinkRemotePagesResult =
	| { ok: true; gridSize: UserConfigGridSize; pages: LinkRemotePage[] }
	| { ok: false; error: 'unknown_peer' | 'incompatible' | 'offline' | 'denied' | 'timeout' }

/**
 * Why a link button is showing what it is showing
 * - `unconfigured`: no peer or location chosen
 * - `bad_location`: the location could not be resolved to a button location
 * - `unknown_peer`: the peer has not been discovered on any transport
 * - `incompatible`: the peer speaks an incompatible protocol version
 * - `offline`: the peer is known but not currently reachable
 * - `denied`: the peer does not share its buttons with this installation
 * - `over_limit`: the peer is already serving as many buttons as it can, so refused this one
 * - `loading`: subscribed, waiting for the first image
 * - `loop`: the remote button is (indirectly) linked back to this installation
 * - `ok`: showing the remote button
 */
export type LinkButtonStatus =
	| 'unconfigured'
	| 'bad_location'
	| 'unknown_peer'
	| 'incompatible'
	| 'offline'
	| 'denied'
	| 'over_limit'
	| 'loading'
	| 'loop'
	| 'ok'

/** Runtime (non-persisted) state of a link button, for the button editor */
export interface LinkButtonRuntimeProps {
	status: LinkButtonStatus
	/** Name of the target peer, when it is known */
	peerName: string | null
}

/** A short, readable form of a Link id, for the user to recognise an installation by */
export function formatLinkIdFingerprint(linkId: string): string {
	return linkId.slice(0, 16).match(/.{4}/g)?.join('-') ?? linkId
}
