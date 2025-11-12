import { useState } from 'react'
import type { EntityDefinitionsForTypeStore } from '~/Stores/EntityDefinitionsStore.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import type { trpc } from '~/Resources/TRPC'
import type { EntityDefinitionUpdate } from '@companion-app/shared/Model/EntityDefinitionModel.js'

export function useEntityDefinitionsSubscription(
	store: EntityDefinitionsForTypeStore,
	endpoint: typeof trpc.instances.definitions.actions | typeof trpc.instances.definitions.feedbacks
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
