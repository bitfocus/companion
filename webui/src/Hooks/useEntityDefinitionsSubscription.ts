import { useSubscription, type DecorateSubscriptionProcedure, type FeatureFlags } from '@trpc/tanstack-react-query'
import { useState } from 'react'
import type {
	ClientEntityDefinition,
	EntityDefinitionUpdate,
} from '@companion-app/shared/Model/EntityDefinitionModel.js'
import type { EntityDefinitionsForTypeStore } from '~/Stores/EntityDefinitionsStore.js'

export function useEntityDefinitionsSubscription<
	TOutput extends EntityDefinitionUpdate<ClientEntityDefinition>,
	TErrorShape,
	TFeatureFlags extends FeatureFlags,
>(
	store: EntityDefinitionsForTypeStore,
	procedure: DecorateSubscriptionProcedure<{
		input: void
		output: AsyncIterable<TOutput, never, any>
		transformer: false
		errorShape: TErrorShape
		featureFlags: TFeatureFlags
	}>
): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		procedure.subscriptionOptions(undefined, {
			onStarted: () => {
				store.updateStore(null)
				setReady(false)
			},
			onData: (data) => {
				store.updateStore(data)
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
