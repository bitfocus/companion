import { describe, expect, it } from 'vitest'
import type {
	LinkPeerInfo,
	LinkTransportConfig,
	LinkTransportSection,
	LinkTransportState,
} from '@companion-app/shared/Model/Link.js'
import { LinkStore } from '../LinkStore.js'

function transport(id: string, sortOrder: number): LinkTransportConfig {
	return { id, type: 'direct', label: id, enabled: true, config: {}, sortOrder, builtin: false }
}

function section(id: string, attention: boolean): LinkTransportSection {
	return { id, title: id, description: null, attention, entries: [] }
}

function state(sections: LinkTransportSection[]): LinkTransportState {
	return { status: 'connected', message: null, info: [], sections }
}

function peer(id: string): LinkPeerInfo {
	return { id, name: id } as LinkPeerInfo
}

describe('LinkStore', () => {
	describe('updateTransports', () => {
		it('replaces the transports on init, and marks them loaded', () => {
			const store = new LinkStore()
			store.updateTransports({ type: 'add', itemId: 'old', info: transport('old', 0) })
			expect(store.transportsLoaded).toBe(false)

			store.updateTransports({ type: 'init', items: { a: transport('a', 0) } })
			expect([...store.transports.keys()]).toEqual(['a'])
			expect(store.transportsLoaded).toBe(true)
		})

		it('adds, replaces and removes a transport', () => {
			const store = new LinkStore()
			store.updateTransports({ type: 'init', items: {} })

			store.updateTransports({ type: 'add', itemId: 'a', info: transport('a', 0) })
			store.updateTransports({ type: 'add', itemId: 'a', info: { ...transport('a', 0), label: 'renamed' } })
			expect(store.transports.get('a')?.label).toBe('renamed')

			store.updateTransports({ type: 'remove', itemId: 'a' })
			expect(store.transports.size).toBe(0)
		})
	})

	describe('attentionSections', () => {
		it('lists the sections needing attention, in the order of the transports', () => {
			const store = new LinkStore()
			store.updateTransports({ type: 'init', items: { a: transport('a', 1), b: transport('b', 0) } })
			store.updateTransportStates({
				type: 'init',
				items: {
					a: state([section('a1', true), section('a2', false)]),
					b: state([section('b1', true)]),
				},
			})

			expect(store.attentionSections.map(({ transportId, section }) => [transportId, section.id])).toEqual([
				['b', 'b1'],
				['a', 'a1'],
			])
		})

		it('ignores the state of a transport that has been removed', () => {
			const store = new LinkStore()
			store.updateTransports({ type: 'init', items: { a: transport('a', 0) } })
			store.updateTransportStates({ type: 'init', items: { a: state([section('a1', true)]) } })

			store.updateTransports({ type: 'remove', itemId: 'a' })
			expect(store.attentionSections).toEqual([])
		})

		it('is empty once the states are cleared', () => {
			const store = new LinkStore()
			store.updateTransports({ type: 'init', items: { a: transport('a', 0) } })
			store.updateTransportStates({ type: 'init', items: { a: state([section('a1', true)]) } })

			store.updateTransportStates(null)
			expect(store.attentionSections).toEqual([])
		})
	})

	describe('setPeers', () => {
		it('marks the peers loaded, and not loaded again when reset', () => {
			const store = new LinkStore()
			expect(store.peersLoaded).toBe(false)

			store.setPeers([peer('b'), peer('a')])
			expect(store.peersLoaded).toBe(true)
			expect(store.sortedPeers.map((p) => p.id)).toEqual(['a', 'b'])

			store.setPeers(null)
			expect(store.peersLoaded).toBe(false)
			expect(store.peers).toEqual([])
		})

		it('counts an empty list as loaded', () => {
			const store = new LinkStore()
			store.setPeers([])
			expect(store.peersLoaded).toBe(true)
		})
	})
})
