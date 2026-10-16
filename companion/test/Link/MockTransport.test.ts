import getPort from 'get-port'
import type { JsonValue } from 'type-fest'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { LinkPermissions, LinkTransportSection, LinkTransportStatus } from '@companion-app/shared/Model/Link.js'
import { LinkIdentity } from '../../lib/Link/Identity.js'
import { MockTransport } from '../../lib/Link/Transports/Mock/MockTransport.js'
import type { LinkMessageOrigin, LinkTransportContext } from '../../lib/Link/Transports/Types.js'
import LogController from '../../lib/Log/Controller.js'

function createContext(name: string) {
	const storage = new Map<string, JsonValue>()
	const received: [string, string, LinkMessageOrigin][] = []
	/** What the core lets each installation use */
	const permissions = new Map<string, LinkPermissions>()
	const state = { status: 'disabled' as LinkTransportStatus, sections: [] as LinkTransportSection[] }

	const context: LinkTransportContext = {
		logger: LogController.createLogger(`test/${name}`),
		identity: LinkIdentity.generate(),
		getName: () => `Name of ${name}`,
		lastWill: { topic: `discovery/${name}`, payload: '', retain: true },
		storage: { get: (key) => storage.get(key), set: (key, value) => storage.set(key, value) },
		receive: (topic, payload, origin) => received.push([topic, payload, origin]),
		getPermissions: (peerId) => permissions.get(peerId) ?? { buttons: false },
		setStatus: (status) => {
			state.status = status
		},
		setInfo: () => {},
		setSections: (sections) => {
			state.sections = sections
		},
	}

	return { context, received, permissions, state }
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

	test('delivers messages, and only shares what is allowed', async () => {
		const port = await getPort()
		const a = await start('a', port)
		const b = await start('b', port)
		// Multicast is not available in every environment
		if (a.ctx.state.status !== 'connected') return

		b.transport.subscribe('test/#')
		a.transport.subscribe('test/#')
		a.transport.publish('test/one', 'hello', { retain: false, requires: null })
		await vi.waitFor(() => expect(b.ctx.received).toHaveLength(1))
		expect(b.ctx.received[0]).toEqual(['test/one', 'hello', { peerId: a.ctx.context.identity.id }])
		expect(b.ctx.state.sections[0].entries.map((e) => e.title)).toEqual(['Name of a'])

		// a hasn't heard from b yet, and shares nothing with it until told to
		b.transport.publish('test/two', 'hi', { retain: false, requires: null })
		await vi.waitFor(() => expect(a.ctx.received).toHaveLength(1))
		a.transport.publish('test/secret', 'nope', { retain: false, requires: 'buttons' })

		a.ctx.permissions.set(b.ctx.context.identity.id, { buttons: true })
		a.transport.publish('test/secret', 'yes', { retain: false, requires: 'buttons' })

		await vi.waitFor(() => expect(b.ctx.received).toHaveLength(2))
		expect(b.ctx.received[1].slice(0, 2)).toEqual(['test/secret', 'yes'])
	})
})
