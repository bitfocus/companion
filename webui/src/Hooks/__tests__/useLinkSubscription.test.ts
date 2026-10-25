import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

interface Handlers {
	onStarted?: () => void
	onData?: (data: unknown) => void
	onError?: (error: unknown) => void
}

const subscriptions: Handlers[] = []
let transportTypes: { data: unknown; isError: boolean } = { data: undefined, isError: false }

const procedure = { subscriptionOptions: (_input: unknown, handlers: Handlers) => handlers, queryOptions: () => ({}) }
vi.mock('~/Resources/TRPC', () => ({
	trpc: {
		link: {
			transportTypes: procedure,
			watchSelf: procedure,
			watchPeers: procedure,
			watchTransports: procedure,
			watchTransportStates: procedure,
		},
	},
}))
vi.mock('@trpc/tanstack-react-query', () => ({ useSubscription: (handlers: Handlers) => subscriptions.push(handlers) }))
vi.mock('@tanstack/react-query', () => ({ useQuery: () => transportTypes }))

const { useLinkSubscription } = await import('../useLinkSubscription.js')

const store = {
	setTransportTypes: vi.fn(),
	setSelf: vi.fn(),
	setPeers: vi.fn(),
	updateTransports: vi.fn(),
	updateTransportStates: vi.fn(),
}

describe('useLinkSubscription', () => {
	it('is ready once everything has failed to load, so that it does not hold up the rest of the UI', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {})
		const { result, rerender } = renderHook(() => useLinkSubscription(store as any))
		expect(result.current).toBe(false)

		act(() => {
			for (const handlers of subscriptions.slice(-4)) handlers.onError?.(new Error('gone'))
		})
		expect(result.current).toBe(false)

		transportTypes = { data: undefined, isError: true }
		rerender()
		expect(result.current).toBe(true)
	})
})
