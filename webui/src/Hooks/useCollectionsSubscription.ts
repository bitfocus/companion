import { useState } from 'react'
import { type FeatureFlags, useSubscription, type DecorateSubscriptionProcedure } from '@trpc/tanstack-react-query'
import type { GenericCollectionsStore } from '~/Stores/GenericCollectionsStore.js'
import type { CollectionBase } from '@companion-app/shared/Model/Collections.js'

export function useGenericCollectionsSubscription<TInput, TOutput, TErrorShape, TFeatureFlags extends FeatureFlags>(
	store: GenericCollectionsStore<TOutput>,
	procedure: DecorateSubscriptionProcedure<{
		input: TInput
		output: AsyncIterable<CollectionBase<TOutput>[], never, any>
		transformer: false
		errorShape: TErrorShape
		featureFlags: TFeatureFlags
	}>,
	input: TInput
): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		procedure.subscriptionOptions(input, {
			onStarted: () => {
				setReady(false)
				store.resetCollections([])
			},
			onData: (data) => {
				setReady(true)
				// TODO - should this debounce?

				store.resetCollections(data)
			},
		})
	)

	return ready
}
