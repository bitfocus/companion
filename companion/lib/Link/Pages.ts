import { nanoid } from 'nanoid'
import type { LinkRemotePagesResult } from '@companion-app/shared/Model/Link.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import type { IPageStore } from '../Page/Store.js'
import type { LinkPeerRegistry } from './PeerRegistry.js'
import {
	encodeLinkMessage,
	LINK_MAX_BUTTONS_PER_PAGE,
	LINK_MAX_PAGES,
	type LinkPayloadOfType,
} from './Protocol/v1/Schemas.js'
import { LINK_PAGES_TIMEOUT_MS } from './Protocol/v1/Timing.js'

/** The pages of buttons of this installation, to answer a `pages.request` with */
export function describeLinkPages(
	pageStore: IPageStore,
	gridSize: UserConfigGridSize,
	id: string
): LinkPayloadOfType<'pages'> {
	const pages: LinkPayloadOfType<'pages'>['pages'] = []
	const pageCount = Math.min(pageStore.getPageCount(), LINK_MAX_PAGES)
	for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
		const buttons = pageStore
			.getAllPopulatedLocationsOnPage(pageNumber)
			// Buttons outside the grid aren't shown anywhere, so aren't offered
			.filter(
				({ row, column }) =>
					row >= gridSize.minRow &&
					row <= gridSize.maxRow &&
					column >= gridSize.minColumn &&
					column <= gridSize.maxColumn
			)
			.slice(0, LINK_MAX_BUTTONS_PER_PAGE)
			.map(({ row, column }) => ({ row, column }))
		pages.push({ page: pageNumber, name: (pageStore.getPageName(pageNumber) ?? '').slice(0, 256), buttons })
	}

	const { minRow, maxRow, minColumn, maxColumn } = gridSize
	return { id, gridSize: { minRow, maxRow, minColumn, maxColumn }, pages }
}

interface PendingRequest {
	peerId: string
	resolve: (result: LinkRemotePagesResult) => void
	timer: NodeJS.Timeout
}

/** Asks other installations for their pages of buttons, for the user to choose a remote button from */
export class LinkPagesClient {
	readonly #peers: LinkPeerRegistry
	readonly #send: (transportId: string, peerId: string, payload: string) => void

	/** Requests waiting for an answer, by id */
	readonly #pending = new Map<string, PendingRequest>()

	constructor(peers: LinkPeerRegistry, send: (transportId: string, peerId: string, payload: string) => void) {
		this.#peers = peers
		this.#send = send
	}

	/** Ask a peer for its pages. Resolves with why not, if it can't be asked or doesn't answer in time */
	async request(peerId: string): Promise<LinkRemotePagesResult> {
		const peer = this.#peers.getPeer(peerId)
		if (!peer) return { ok: false, error: 'unknown_peer' }
		if (!peer.compatible) return { ok: false, error: 'incompatible' }
		if (peer.sharedWithUs?.buttons === false) return { ok: false, error: 'denied' }
		const route = this.#peers.getRoute(peerId)
		if (!route) return { ok: false, error: 'offline' }

		const id = nanoid()
		return new Promise((resolve) => {
			const timer = setTimeout(() => {
				this.#pending.delete(id)
				resolve({ ok: false, error: 'timeout' })
			}, LINK_PAGES_TIMEOUT_MS)
			this.#pending.set(id, { peerId, resolve, timer })
			this.#send(route, peerId, encodeLinkMessage('pages.request', { id }))
		})
	}

	/** A peer answered a request. Only accepted from the peer it was sent to */
	handlePages(peerId: string, payload: LinkPayloadOfType<'pages'>): void {
		const pending = this.#pending.get(payload.id)
		if (!pending || pending.peerId !== peerId) return

		clearTimeout(pending.timer)
		this.#pending.delete(payload.id)
		pending.resolve({
			ok: true,
			gridSize: payload.gridSize,
			pages: payload.pages.map(({ page, name, buttons }) => ({ pageNumber: page, name, buttons })),
		})
	}

	/** Give up on every request still waiting */
	clear(): void {
		for (const pending of this.#pending.values()) {
			clearTimeout(pending.timer)
			pending.resolve({ ok: false, error: 'timeout' })
		}
		this.#pending.clear()
	}
}
