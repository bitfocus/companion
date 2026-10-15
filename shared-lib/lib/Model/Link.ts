import type { JsonValue } from 'type-fest'
import type { CompanionInputFieldSecretExtended } from './Options.js'
import type { CompanionSurfaceConfigField } from './Surfaces.js'

/**
 * Companion Link: linking Companion installations together, over one or more transports.
 * These types are shared between the backend and the UI.
 */

/** A config field of a transport. The UI renders the transport config editor from these */
export type LinkTransportConfigField = CompanionSurfaceConfigField | CompanionInputFieldSecretExtended

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

/** The runtime state of a configured transport */
export interface LinkTransportState {
	status: LinkTransportStatus
	/** Explanation of the status, eg the error */
	message: string | null
	info: LinkTransportInfoItem[]
}

export type LinkTransportsUpdate =
	| { type: 'init'; items: Record<string, LinkTransportConfig> }
	| { type: 'add'; itemId: string; info: LinkTransportConfig }
	| { type: 'remove'; itemId: string }

export type LinkTransportStatesUpdate =
	| { type: 'init'; items: Record<string, LinkTransportState> }
	| { type: 'update'; itemId: string; state: LinkTransportState }
	| { type: 'remove'; itemId: string }

/** A Companion installation discovered on at least one transport */
export interface LinkPeerInfo {
	id: string
	name: string
	companionVersion: string
	protocolVersion: string
	/** Whether we speak a compatible protocol version. Incompatible peers are listed but can't be used */
	compatible: boolean
	pageCount: number
	grid: { minRow: number; maxRow: number; minColumn: number; maxColumn: number }
	/** Ids of the transports the peer is currently reachable on */
	transportIds: string[]
	/** Whether the peer is reachable on any transport */
	online: boolean
	/** Unix timestamp (ms) of the last announcement received */
	lastSeen: number
}

/** Information about this installation, as seen by peers */
export interface LinkSelfInfo {
	id: string
	name: string
	protocolVersion: string
}

/**
 * Why a link button is showing what it is showing
 * - `unconfigured`: no peer or location chosen, or the location could not be resolved
 * - `unknown_peer`: the peer has not been discovered on any transport
 * - `incompatible`: the peer speaks an incompatible protocol version
 * - `offline`: the peer is known but not currently reachable
 * - `loading`: subscribed, waiting for the first image
 * - `loop`: the remote button is (indirectly) linked back to this installation
 * - `ok`: showing the remote button
 */
export type LinkButtonStatus = 'unconfigured' | 'unknown_peer' | 'incompatible' | 'offline' | 'loading' | 'loop' | 'ok'

/** Runtime (non-persisted) state of a link button, for the button editor */
export interface LinkButtonRuntimeProps {
	status: LinkButtonStatus
	/** Name of the target peer, when it is known */
	peerName: string | null
}
