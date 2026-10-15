import { describe, expect, test, vi } from 'vitest'
import { PeerConnectionBus } from '../../lib/Link/Transports/Direct/PeerConnectionBus.js'

function createBus(localRetained = new Map<string, string>(), localSubscriptions = new Set<string>()) {
	const sent: unknown[] = []
	const deliver = vi.fn<(topic: string, payload: string) => void>()
	const bus = new PeerConnectionBus((frame) => sent.push(JSON.parse(frame)), deliver, localRetained, localSubscriptions)
	return { bus, sent, deliver }
}

describe('PeerConnectionBus', () => {
	test('sends existing subscriptions when the connection opens', () => {
		const { sent } = createBus(new Map(), new Set(['a/+']))
		expect(sent).toEqual([{ op: 'sub', pattern: 'a/+' }])
	})

	test('only publishes what the other side subscribed to', () => {
		const { bus, sent } = createBus()
		bus.publish('a/b', 'one', false)
		expect(sent).toEqual([])

		bus.handleFrame(JSON.stringify({ op: 'sub', pattern: 'a/+' }))
		bus.publish('a/b', 'two', false)
		bus.publish('c/d', 'three', false)
		expect(sent).toEqual([{ op: 'pub', topic: 'a/b', payload: 'two', retain: false }])

		bus.handleFrame(JSON.stringify({ op: 'unsub', pattern: 'a/+' }))
		bus.publish('a/b', 'four', false)
		expect(sent).toHaveLength(1)
	})

	test('sends matching retained messages when the other side subscribes', () => {
		const { bus, sent } = createBus(
			new Map([
				['discovery/me', 'hello'],
				['other/me', 'x'],
			])
		)
		bus.handleFrame(JSON.stringify({ op: 'sub', pattern: 'discovery/+' }))
		expect(sent).toEqual([{ op: 'pub', topic: 'discovery/me', payload: 'hello', retain: true }])
	})

	test('only delivers what we are subscribed to', () => {
		const { bus, deliver } = createBus(new Map(), new Set(['a/+']))
		bus.handleFrame(JSON.stringify({ op: 'pub', topic: 'a/b', payload: 'one', retain: false }))
		bus.handleFrame(JSON.stringify({ op: 'pub', topic: 'c/d', payload: 'two', retain: false }))
		expect(deliver.mock.calls).toEqual([['a/b', 'one']])
	})

	test('clears what the other side retained when the connection closes', () => {
		const { bus, deliver } = createBus(new Map(), new Set(['discovery/+']))
		bus.handleFrame(JSON.stringify({ op: 'pub', topic: 'discovery/them', payload: 'hello', retain: true }))
		deliver.mockClear()

		bus.close()
		expect(deliver.mock.calls).toEqual([['discovery/them', '']])
	})

	test('does not clear retained topics the other side already cleared', () => {
		const { bus, deliver } = createBus(new Map(), new Set(['discovery/+']))
		bus.handleFrame(JSON.stringify({ op: 'pub', topic: 'discovery/them', payload: 'hello', retain: true }))
		bus.handleFrame(JSON.stringify({ op: 'pub', topic: 'discovery/them', payload: '', retain: true }))
		deliver.mockClear()

		bus.close()
		expect(deliver).not.toHaveBeenCalled()
	})

	test('rejects invalid frames', () => {
		const { bus } = createBus()
		expect(bus.handleFrame('nope').ok).toBe(false)
		expect(bus.handleFrame(JSON.stringify({ op: 'explode' })).ok).toBe(false)
	})

	test('does nothing after close', () => {
		const { bus, sent } = createBus()
		bus.handleFrame(JSON.stringify({ op: 'sub', pattern: '#' }))
		bus.close()
		bus.publish('a', 'b', false)
		expect(sent).toEqual([])
	})
})
