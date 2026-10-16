import { beforeEach, describe, expect, test, vi } from 'vitest'
import { LinkTransportManager } from '../../lib/Link/TransportManager.js'
import type { LinkTransport, LinkTransportContext, LinkTransportDefinition } from '../../lib/Link/Transports/Types.js'
import { FakeDataDatabase } from '../utils/FakeTableView.js'

const origin = { connectionId: 'connection', permissions: { buttons: true } }

class FakeTransport implements LinkTransport {
	readonly context: LinkTransportContext
	readonly config: { host: string }
	readonly published: [string, string, boolean][] = []
	readonly subscriptions = new Set<string>()
	destroyed = false

	constructor(context: LinkTransportContext, config: { host: string }) {
		this.context = context
		this.config = config
	}
	publish(topic: string, payload: string, options: { retain: boolean }): void {
		this.published.push([topic, payload, options.retain])
	}
	subscribe(pattern: string): void {
		this.subscriptions.add(pattern)
	}
	unsubscribe(pattern: string): void {
		this.subscriptions.delete(pattern)
	}
	async handleAction(entryId: string, actionId: string, input: string | null): Promise<string | null> {
		return entryId === 'entry' && actionId === 'go' ? null : `Unknown ${entryId}/${actionId}/${input}`
	}
	async destroy(): Promise<void> {
		this.destroyed = true
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
		() => 'self',
		() => 'Self',
		() => ({ topic: 'discovery/self', payload: '', retain: true })
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

	test('rejects unknown types', () => {
		expect(() => ctx.manager.add('nope', 'Nope')).toThrow()
	})

	test('applies existing subscriptions to new transports', () => {
		ctx.manager.subscribe('a/+')
		ctx.manager.add('fake', 'One')
		expect([...ctx.instances[0].subscriptions]).toEqual(['a/+'])
	})

	test('reference counts subscriptions', () => {
		ctx.manager.add('fake', 'One')
		ctx.manager.subscribe('a/+')
		ctx.manager.subscribe('a/+')
		ctx.manager.unsubscribe('a/+')
		expect(ctx.instances[0].subscriptions.has('a/+')).toBe(true)
		ctx.manager.unsubscribe('a/+')
		expect(ctx.instances[0].subscriptions.has('a/+')).toBe(false)
	})

	test('only publishes on connected transports', () => {
		ctx.manager.add('fake', 'One')
		ctx.manager.publishAll('a', 'b', { retain: false, requires: null })
		expect(ctx.instances[0].published).toEqual([])

		ctx.instances[0].context.setStatus('connected', null)
		ctx.manager.publishAll('a', 'b', { retain: false, requires: null })
		expect(ctx.instances[0].published).toEqual([['a', 'b', false]])
	})

	test('reports connection changes and messages', () => {
		const connected = vi.fn()
		const disconnected = vi.fn()
		const message = vi.fn()
		ctx.manager.events.on('transportConnected', connected)
		ctx.manager.events.on('transportDisconnected', disconnected)
		ctx.manager.events.on('message', message)

		const id = ctx.manager.add('fake', 'One')
		const transport = ctx.instances[0]
		transport.context.setStatus('connected', null)
		transport.context.receive('topic', 'payload', origin)
		transport.context.setStatus('error', 'boom')

		expect(connected).toHaveBeenCalledWith(id)
		expect(message).toHaveBeenCalledWith(id, 'topic', 'payload', origin)
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

	test('says goodbye when stopping a transport', async () => {
		const id = ctx.manager.add('fake', 'One')
		ctx.instances[0].context.setStatus('connected', null)

		await ctx.manager.setEnabled(id, false)
		expect(ctx.instances[0].published).toEqual([['discovery/self', '', true]])
		expect(ctx.instances[0].destroyed).toBe(true)
		expect(ctx.manager.getStates()[id].status).toBe('disabled')
	})

	test('ignores a stopped transport', async () => {
		const message = vi.fn()
		ctx.manager.events.on('message', message)

		const id = ctx.manager.add('fake', 'One')
		const transport = ctx.instances[0]
		await ctx.manager.setEnabled(id, false)

		transport.context.receive('topic', 'payload', origin)
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
			() => 'self',
			() => 'Self',
			() => ({ topic: 'discovery/self', payload: '', retain: true })
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
		expect(await ctx.manager.handleAction(id, 'entry', 'go', null)).toBeNull()
		expect(await ctx.manager.handleAction(id, 'entry', 'nope', 'x')).toBe('Unknown entry/nope/x')
		expect(await ctx.manager.handleAction('missing', 'entry', 'go', null)).toMatch(/not running/)
	})

	test('reports permission changes of a connection', () => {
		const changed = vi.fn()
		ctx.manager.events.on('permissionsChanged', changed)
		const id = ctx.manager.add('fake', 'One')
		ctx.instances[0].context.setConnectionPermissions('connection', { buttons: true })
		expect(changed).toHaveBeenCalledWith(id, 'connection', { buttons: true })
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
