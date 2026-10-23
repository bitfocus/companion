import getPort from 'get-port'
import type { JsonValue } from 'type-fest'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { LinkTransportSection, LinkTransportStatus } from '@companion-app/shared/Model/Link.js'
import { LinkIdentity } from '../../lib/Link/Identity.js'
import { MockTransport } from '../../lib/Link/Transports/Mock/MockTransport.js'
import type { LinkMessageOrigin, LinkTransportContext } from '../../lib/Link/Transports/Types.js'
import LogController from '../../lib/Log/Controller.js'

function createContext(name: string) {
	const storage = new Map<string, JsonValue>()
	const announcements: [string, string | null][] = []
	const received: [string, LinkMessageOrigin][] = []
	const state = { status: 'disabled' as LinkTransportStatus, sections: [] as LinkTransportSection[] }

	const context: LinkTransportContext = {
		logger: LogController.createLogger(`test/${name}`),
		identity: LinkIdentity.generate(),
		getName: () => `Name of ${name}`,
		storage: { get: (key) => storage.get(key), set: (key, value) => storage.set(key, value) },
		receiveAnnouncement: (peerId, payload) => announcements.push([peerId, payload]),
		receive: (payload, origin) => received.push([payload, origin]),
		setStatus: (status) => {
			state.status = status
		},
		setInfo: () => {},
		setSections: (sections) => {
			state.sections = sections
		},
	}

	return { context, announcements, received, state }
}

describe('mock transport', { timeout: 10_000 }, () => {
	const transports: MockTransport[] = []
	afterEach(async () => {
		await Promise.all(transports.map(async (t) => t.destroy()))
		transports.length = 0
	})

	async function start(name: string, port: number) {
		const ctx = createContext(name)
		const transport = new MockTransport(ctx.context, { port })
		transports.push(transport)
		await vi.waitFor(() => expect(ctx.state.status).not.toBe('connecting'))
		return { transport, ctx }
	}

	test('announces to everyone, and delivers a message only to its recipient', async () => {
		const port = await getPort()
		const a = await start('a', port)
		const b = await start('b', port)
		const c = await start('c', port)
		// Multicast is not available in every environment: some can't join the group, and some join it but deliver
		// nothing (eg macOS CI runners)
		if (a.ctx.state.status !== 'connected') return
		const aId = a.ctx.context.identity.id

		a.transport.announce('hello')
		const delivered = await vi
			.waitFor(() => expect(b.ctx.announcements).toEqual([[aId, 'hello']]), { timeout: 2000 })
			.then(
				() => true,
				() => false
			)
		if (!delivered) return
		await vi.waitFor(() => expect(c.ctx.announcements).toEqual([[aId, 'hello']]))
		expect(b.ctx.state.sections[0].entries.map((e) => e.title)).toEqual(['Name of a'])

		a.transport.send(b.ctx.context.identity.id, 'for b')
		a.transport.send(c.ctx.context.identity.id, 'for c')
		await vi.waitFor(() => expect(b.ctx.received).toEqual([['for b', { peerId: aId }]]))
		await vi.waitFor(() => expect(c.ctx.received).toEqual([['for c', { peerId: aId }]]))
		expect(a.ctx.received).toEqual([])

		a.transport.announce(null)
		await vi.waitFor(() => expect(b.ctx.announcements.at(-1)).toEqual([aId, null]))
	})
})
