import { beforeEach, describe, expect, test, vi } from 'vitest'
import { LinkIdentity } from '../../lib/Link/Identity.js'
import { LinkTransportManager } from '../../lib/Link/TransportManager.js'
import type { LinkTransport, LinkTransportContext, LinkTransportDefinition } from '../../lib/Link/Transports/Types.js'
import { FakeDataDatabase } from '../utils/FakeTableView.js'

const identity = LinkIdentity.generate()
const origin = { peerId: 'peer' }

class FakeTransport implements LinkTransport {
	readonly context: LinkTransportContext
	readonly config: { host: string }
	readonly announced: (string | null)[] = []
	readonly sent: [string, string][] = []
	destroyed = false

	constructor(context: LinkTransportContext, config: { host: string }) {
		this.context = context
		this.config = config
	}
	announce(payload: string | null): void {
		this.announced.push(payload)
	}
	send(peerId: string, payload: string): void {
		this.sent.push([peerId, payload])
	}
	async handleSectionAction(entryId: string, actionId: string, input: string | null): Promise<string | null> {
		return entryId === 'entry' && actionId === 'go' ? null : `Unknown ${entryId}/${actionId}/${input}`
	}
	/** Resolved when it has finished being destroyed, so a test can hold it up */
	destroying = Promise.resolve()
	async destroy(): Promise<void> {
		this.destroyed = true
		await this.destroying
	}
}

function fakeDefinition(instances: FakeTransport[]): LinkTransportDefinition<{ host: string }> {
	return {
		type: 'fake',
		name: 'Fake',
		description: 'A fake transport',
		configFields: [{ id: 'host', type: 'textinput', label: 'Host', default: 'localhost', regex: '/^[a-z]+$/' }],
		create: (context, config) => {
			const transport = new FakeTransport(context, config)
			instances.push(transport)
			return transport
		},
	}
}

function createManager() {
	const instances: FakeTransport[] = []
	const definition = fakeDefinition(instances)

	const db = new FakeDataDatabase()
	const manager = new LinkTransportManager(
		db.asDataDatabase(),
		[definition],
		() => identity,
		() => 'Self'
	)
	return { manager, instances, db }
}

describe('LinkTransportManager', () => {
	let ctx: ReturnType<typeof createManager>
	beforeEach(() => {
		ctx = createManager()
	})

	test('adding a transport starts it with the default config', () => {
		ctx.manager.start()
		const id = ctx.manager.add('fake', 'My fake')

		expect(ctx.instances).toHaveLength(1)
		expect(ctx.instances[0].config).toEqual({ host: 'localhost' })
		expect(ctx.manager.getConfigs()[id]).toMatchObject({ label: 'My fake', enabled: true })
		expect(ctx.db.getTableView('link_transports').data[id]).toBeDefined()
	})

	test('reports a saved transport whose type no longer exists, rather than showing it disabled', () => {
		const id = ctx.manager.add('fake', 'One')
		const fresh = new LinkTransportManager(
			ctx.db.asDataDatabase(),
			[],
			() => identity,
			() => 'Self'
		)
		fresh.start()
		expect(fresh.getStates()[id]).toMatchObject({ status: 'error', message: 'Unknown transport type "fake"' })
	})

	test('rejects unknown types', () => {
		expect(() => ctx.manager.add('nope', 'Nope')).toThrow()
	})

	test('only announces and sends on connected transports', () => {
		ctx.manager.add('fake', 'One')
		const [id] = Object.keys(ctx.manager.getStates())
		ctx.manager.announceAll('hello')
		ctx.manager.sendTo(id, 'peer', 'message')
		expect(ctx.instances[0].announced).toEqual([])
		expect(ctx.instances[0].sent).toEqual([])

		ctx.instances[0].context.setStatus('connected', null)
		ctx.manager.announceAll('hello')
		ctx.manager.sendTo(id, 'peer', 'message')
		expect(ctx.instances[0].announced).toEqual(['hello'])
		expect(ctx.instances[0].sent).toEqual([['peer', 'message']])
	})

	test('sends on one transport only', () => {
		ctx.manager.add('fake', 'One')
		ctx.manager.add('fake', 'Two')
		const [one, two] = ctx.instances
		one.context.setStatus('connected', null)
		two.context.setStatus('connected', null)

		const [oneId] = Object.keys(ctx.manager.getStates())
		ctx.manager.sendTo(oneId, 'peer', 'message')
		expect(one.sent).toEqual([['peer', 'message']])
		expect(two.sent).toEqual([])
	})

	test('reports connection changes and messages', () => {
		const connected = vi.fn()
		const disconnected = vi.fn()
		const announcement = vi.fn()
		const message = vi.fn()
		ctx.manager.events.on('transportConnected', connected)
		ctx.manager.events.on('transportDisconnected', disconnected)
		ctx.manager.events.on('announcement', announcement)
		ctx.manager.events.on('message', message)

		const id = ctx.manager.add('fake', 'One')
		const transport = ctx.instances[0]
		transport.context.setStatus('connected', null)
		transport.context.receiveAnnouncement('peer', 'hello')
		transport.context.receiveAnnouncement('peer', null)
		transport.context.receive('payload', origin)
		transport.context.setStatus('error', 'boom')

		expect(connected).toHaveBeenCalledWith(id)
		expect(announcement).toHaveBeenNthCalledWith(1, id, 'peer', 'hello')
		expect(announcement).toHaveBeenNthCalledWith(2, id, 'peer', null)
		expect(message).toHaveBeenCalledWith(id, 'payload', origin)
		expect(disconnected).toHaveBeenCalledWith(id)
		expect(ctx.manager.getStates()[id]).toEqual({ status: 'error', message: 'boom', info: [], sections: [] })
	})

	test('updating the config validates it and replaces the running transport', async () => {
		const id = ctx.manager.add('fake', 'One')

		expect(await ctx.manager.update(id, 'One', { host: 'NOT VALID' })).toMatchObject({ ok: false })
		expect(ctx.instances).toHaveLength(1)

		expect(await ctx.manager.update(id, 'Renamed', { host: 'other' })).toEqual({ ok: true })
		expect(ctx.instances).toHaveLength(2)
		expect(ctx.instances[0].destroyed).toBe(true)
		expect(ctx.instances[1].config).toEqual({ host: 'other' })
		expect(ctx.manager.getConfigs()[id].label).toBe('Renamed')
	})

	test('stopping all waits for a transport that is already being stopped', async () => {
		const id = ctx.manager.add('fake', 'One')
		let finishDestroying = () => {}
		ctx.instances[0].destroying = new Promise((resolve) => {
			finishDestroying = resolve
		})

		const disabling = ctx.manager.setEnabled(id, false)
		let stopped = false
		const stopping = ctx.manager.stopAll().then(() => {
			stopped = true
		})
		await new Promise((resolve) => setImmediate(resolve))
		expect(stopped).toBe(false)

		finishDestroying()
		await Promise.all([disabling, stopping])
		expect(stopped).toBe(true)
	})

	test('says goodbye when stopping a transport', async () => {
		const id = ctx.manager.add('fake', 'One')
		ctx.instances[0].context.setStatus('connected', null)

		await ctx.manager.setEnabled(id, false)
		expect(ctx.instances[0].announced).toEqual([null])
		expect(ctx.instances[0].destroyed).toBe(true)
		expect(ctx.manager.getStates()[id].status).toBe('disabled')
	})

	test('ignores a stopped transport', async () => {
		const message = vi.fn()
		ctx.manager.events.on('message', message)

		const id = ctx.manager.add('fake', 'One')
		const transport = ctx.instances[0]
		await ctx.manager.setEnabled(id, false)

		transport.context.receive('payload', origin)
		expect(message).not.toHaveBeenCalled()
	})

	test('does not start a transport with an incomplete config, and says why', () => {
		const id = ctx.manager.add('fake', 'One')
		ctx.instances.length = 0

		// Simulate a config saved before a required field was added
		ctx.db.getTableView('link_transports').data[id].config = { host: '' }
		const fresh = new LinkTransportManager(
			ctx.db.asDataDatabase(),
			[
				{
					...fakeDefinition(ctx.instances),
					configFields: [{ id: 'host', type: 'textinput', label: 'Host', default: '', minLength: 1 }],
				},
			],
			() => identity,
			() => 'Self'
		)
		fresh.start()
		expect(ctx.instances).toHaveLength(0)
		expect(fresh.getStates()[id]).toMatchObject({ status: 'error', message: 'Complete the settings: Host' })
	})

	test('passes actions to the transport, and reports sections', async () => {
		const id = ctx.manager.add('fake', 'One')
		const section = { id: 's', title: 'S', description: null, attention: true, entries: [] }
		ctx.instances[0].context.setSections([section])

		expect(ctx.manager.getStates()[id].sections).toEqual([section])
		expect(await ctx.manager.handleSectionAction(id, 'entry', 'go', null)).toBeNull()
		expect(await ctx.manager.handleSectionAction(id, 'entry', 'nope', 'x')).toBe('Unknown entry/nope/x')
		expect(await ctx.manager.handleSectionAction('missing', 'entry', 'go', null)).toMatch(/not running/)
	})

	test('removing a transport deletes its config and storage', async () => {
		const id = ctx.manager.add('fake', 'One')
		ctx.instances[0].context.storage.set('key', 'value')
		expect(ctx.db.getTableView('link_transport_storage').data[id]).toEqual({ key: 'value' })

		await ctx.manager.remove(id)
		expect(ctx.manager.getConfigs()).toEqual({})
		expect(ctx.db.getTableView('link_transport_storage').data[id]).toBeUndefined()
	})
})
