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
