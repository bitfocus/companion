import { useState } from 'react'
import { EntityDefinitionsForTypeStore } from '~/Stores/EntityDefinitionsStore.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'
import { EntityDefinitionUpdate } from '@companion-app/shared/Model/EntityDefinitionModel.js'

export function useEntityDefinitionsSubscription(
	store: EntityDefinitionsForTypeStore,
	endpoint: typeof trpc.connections.definitions.actions | typeof trpc.connections.definitions.feedbacks
): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		endpoint.subscriptionOptions(undefined, {
			onStarted: () => {
				store.updateStore(null)
				setReady(false)
			},
			onData: (data) => {
				store.updateStore(data as EntityDefinitionUpdate) // TODO - some type errors due to optionals
				setReady(true)
			},
			onError: (e) => {
				store.updateStore(null)
				console.error(`Failed to load ${store.entityType} definitions list`, e)
			},
		})
	)

	return ready
}
