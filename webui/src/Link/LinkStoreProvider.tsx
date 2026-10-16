import { useQuery } from '@tanstack/react-query'
import { useSubscription } from '@trpc/tanstack-react-query'
import { useEffect, useState } from 'react'
import { trpc } from '~/Resources/TRPC.js'
import { LinkStore } from './LinkStore.js'
import { LinkStoreContext } from './LinkStoreContext.js'

/** Streams the state of Companion Link from the backend, for the pages below it */
export function LinkStoreProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
	const [store] = useState(() => new LinkStore())

	const transportTypes = useQuery(trpc.link.transportTypes.queryOptions())
	useEffect(() => store.setTransportTypes(transportTypes.data ?? null), [store, transportTypes.data])

	useSubscription(
		trpc.link.watchSelf.subscriptionOptions(undefined, {
			onStarted: () => store.setSelf(null),
			onData: (data) => store.setSelf(data),
		})
	)
	useSubscription(
		trpc.link.watchPeers.subscriptionOptions(undefined, {
			onStarted: () => store.setPeers(null),
			onData: (data) => store.setPeers(data),
		})
	)
	useSubscription(
		trpc.link.watchTransports.subscriptionOptions(undefined, {
			// Not cleared when (re)started, as that would close an open editor and lose its changes. 'init' replaces it
			onData: (data) => store.updateTransports(data),
		})
	)
	useSubscription(
		trpc.link.watchTransportStates.subscriptionOptions(undefined, {
			onStarted: () => store.updateTransportStates(null),
			onData: (data) => store.updateTransportStates(data),
		})
	)

	return <LinkStoreContext.Provider value={store}>{children}</LinkStoreContext.Provider>
}
