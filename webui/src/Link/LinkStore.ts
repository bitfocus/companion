import { action, computed, makeObservable, observable } from 'mobx'
import type {
	ClientLinkTransportType,
	LinkPeerInfo,
	LinkSelfInfo,
	LinkTransportConfig,
	LinkTransportSection,
	LinkTransportState,
	LinkTransportStatesUpdate,
	LinkTransportsUpdate,
} from '@companion-app/shared/Model/Link.js'
import { assertNever } from '~/Resources/util.js'

/** The state of Companion Link, as streamed from the backend */
export class LinkStore {
	readonly transports = observable.map<string, LinkTransportConfig>()
	readonly transportStates = observable.map<string, LinkTransportState>()
	readonly transportTypes = observable.map<string, ClientLinkTransportType>()
	/** Whether the initial list of transports has arrived */
	transportsLoaded = false
	peers: LinkPeerInfo[] = []
	/** Whether the initial list of peers has arrived */
	peersLoaded = false
	self: LinkSelfInfo | null = null

	constructor() {
		makeObservable(this, {
			transportsLoaded: observable,
			peers: observable.ref,
			peersLoaded: observable,
			self: observable.ref,
			sortedTransports: computed,
			addableTransportTypes: computed,
			attentionSections: computed,
			sortedPeers: computed,
		})
	}

	get sortedTransports(): LinkTransportConfig[] {
		return Array.from(this.transports.values()).sort((a, b) => a.sortOrder - b.sortOrder)
	}

	/** The transport types the user can add, in the order the backend offers them */
	get addableTransportTypes(): ClientLinkTransportType[] {
		return Array.from(this.transportTypes.values()).filter((type) => !type.builtin)
	}

	/** The sections of every transport that need the user's attention, eg pairing requests */
	get attentionSections(): { transportId: string; section: LinkTransportSection }[] {
		return this.sortedTransports.flatMap((transport) =>
			(this.transportStates.get(transport.id)?.sections ?? [])
				.filter((section) => section.attention)
				.map((section) => ({ transportId: transport.id, section }))
		)
	}

	get sortedPeers(): LinkPeerInfo[] {
		return this.peers.toSorted((a, b) => a.name.localeCompare(b.name))
	}

	setTransportTypes = action((types: ClientLinkTransportType[] | null) => {
		this.transportTypes.replace((types ?? []).map((t) => [t.type, t]))
	})

	setPeers = action((peers: LinkPeerInfo[] | null) => {
		this.peers = peers ?? []
		this.peersLoaded = peers !== null
	})

	setSelf = action((self: LinkSelfInfo | null) => {
		this.self = self
	})

	updateTransports = action((update: LinkTransportsUpdate) => {
		switch (update.type) {
			case 'init':
				this.transports.replace(update.items)
				this.transportsLoaded = true
				break
			case 'add':
				this.transports.set(update.itemId, update.info)
				break
			case 'remove':
				this.transports.delete(update.itemId)
				break
			default:
				assertNever(update)
		}
	})

	updateTransportStates = action((update: LinkTransportStatesUpdate | null) => {
		if (!update) {
			this.transportStates.clear()
			return
		}

		switch (update.type) {
			case 'init':
				this.transportStates.replace(update.items)
				break
			case 'update':
				this.transportStates.set(update.itemId, update.state)
				break
			case 'remove':
				this.transportStates.delete(update.itemId)
				break
			default:
				assertNever(update)
		}
	})
}
