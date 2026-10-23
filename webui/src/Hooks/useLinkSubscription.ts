import { useQuery } from '@tanstack/react-query'
import { useSubscription } from '@trpc/tanstack-react-query'
import { useEffect, useState } from 'react'
import { trpc } from '~/Resources/TRPC.js'
import type { LinkStore } from '~/Stores/LinkStore.js'

/** Streams the state of Companion Link into the store. Ready once the initial state has arrived */
export function useLinkSubscription(store: LinkStore): boolean {
	const [selfReady, setSelfReady] = useState(false)
	const [peersReady, setPeersReady] = useState(false)
	const [transportsReady, setTransportsReady] = useState(false)
	const [statesReady, setStatesReady] = useState(false)

	const transportTypes = useQuery(trpc.link.transportTypes.queryOptions())
	useEffect(() => store.setTransportTypes(transportTypes.data ?? null), [store, transportTypes.data])

	useSubscription(
		trpc.link.watchSelf.subscriptionOptions(undefined, {
			onStarted: () => {
				setSelfReady(false)
				store.setSelf(null)
			},
			onData: (data) => {
				setSelfReady(true)
				store.setSelf(data)
			},
			onError: (error) => console.error('Failed to subscribe to link info:', error),
		})
	)
	useSubscription(
		trpc.link.watchPeers.subscriptionOptions(undefined, {
			onStarted: () => {
				setPeersReady(false)
				store.setPeers(null)
			},
			onData: (data) => {
				setPeersReady(true)
				store.setPeers(data)
			},
			onError: (error) => console.error('Failed to subscribe to link peers:', error),
		})
	)
	useSubscription(
		trpc.link.watchTransports.subscriptionOptions(undefined, {
			onStarted: () => setTransportsReady(false),
			// Not cleared when (re)started, as that would close an open editor and lose its changes. 'init' replaces it
			onData: (data) => {
				setTransportsReady(true)
				store.updateTransports(data)
			},
			onError: (error) => console.error('Failed to subscribe to link transports:', error),
		})
	)
	useSubscription(
		trpc.link.watchTransportStates.subscriptionOptions(undefined, {
			onStarted: () => {
				setStatesReady(false)
				store.updateTransportStates(null)
			},
			onData: (data) => {
				setStatesReady(true)
				store.updateTransportStates(data)
			},
			onError: (error) => console.error('Failed to subscribe to link transport states:', error),
		})
	)

	return selfReady && peersReady && transportsReady && statesReady && !!transportTypes.data
}
