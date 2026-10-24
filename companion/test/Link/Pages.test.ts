import { afterEach, describe, expect, test, vi } from 'vitest'
import { LinkPagesClient } from '../../lib/Link/Pages.js'
import { LinkPeerRegistry } from '../../lib/Link/PeerRegistry.js'
import { decodeLinkMessage } from '../../lib/Link/Protocol/v1/Schemas.js'
import { LINK_PAGES_TIMEOUT_MS } from '../../lib/Link/Protocol/v1/Timing.js'
import { FakeTableView } from '../utils/FakeTableView.js'

function createClient() {
	const peers = new LinkPeerRegistry('self', new FakeTableView<any>().asTableView())
	const sent: { transportId: string; peerId: string; id: string }[] = []
	const client = new LinkPagesClient(peers, (transportId, peerId, payload) => {
		const decoded = decodeLinkMessage(payload)
		if (!decoded.ok || decoded.message.type !== 'pages.request') throw new Error('Not a pages request')
		sent.push({ transportId, peerId, id: decoded.message.payload.id })
	})
	peers.handleAnnouncement(
		't1',
		'peer',
		{ name: 'Peer', companionVersion: '5.2.0', protocolVersions: ['1.0.0'], announceIntervalMs: 1000 },
		0
	)
	return { client, peers, sent }
}

const pages = {
	gridSize: { minRow: 0, maxRow: 3, minColumn: 0, maxColumn: 7 },
	pages: [{ page: 1, name: 'One', buttons: [{ row: 0, column: 1 }] }],
}

describe('LinkPagesClient', () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	test('asks a peer over its route, and is answered by it alone', async () => {
		const { client, sent } = createClient()
		const result = client.request('peer')
		expect(sent).toEqual([{ transportId: 't1', peerId: 'peer', id: expect.any(String) }])

		// Not from another peer, or for another request
		client.handlePages('other', { id: sent[0].id, ...pages })
		client.handlePages('peer', { id: 'other', ...pages })
		client.handlePages('peer', { id: sent[0].id, ...pages })

		expect(await result).toEqual({
			ok: true,
			gridSize: pages.gridSize,
			pages: [{ pageNumber: 1, name: 'One', buttons: [{ row: 0, column: 1 }] }],
		})
	})

	test('says why a peer can not be asked', async () => {
		const { client, peers, sent } = createClient()
		expect(await client.request('unknown')).toEqual({ ok: false, error: 'unknown_peer' })

		peers.handleAccess('peer', { buttons: false })
		expect(await client.request('peer')).toEqual({ ok: false, error: 'denied' })

		peers.handleAccess('peer', { buttons: true })
		peers.handleTransportDisconnected('t1')
		expect(await client.request('peer')).toEqual({ ok: false, error: 'offline' })
		expect(sent).toEqual([])
	})

	test('says it is denied as soon as the peer says so, rather than waiting for an answer', async () => {
		const { client } = createClient()
		const result = client.request('peer')
		client.handleDenied('other')
		client.handleDenied('peer')
		expect(await result).toEqual({ ok: false, error: 'denied' })
	})

	test('gives up on a peer that does not answer', async () => {
		vi.useFakeTimers()
		const { client } = createClient()
		const result = client.request('peer')
		await vi.advanceTimersByTimeAsync(LINK_PAGES_TIMEOUT_MS)
		expect(await result).toEqual({ ok: false, error: 'timeout' })
	})
})
