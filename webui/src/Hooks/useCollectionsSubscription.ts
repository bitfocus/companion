import { useState } from 'react'
import { DecorateSubscriptionProcedure, useSubscription } from '@trpc/tanstack-react-query'
import { GenericCollectionsStore } from '~/Stores/GenericCollectionsStore.js'
import { CollectionBase } from '@companion-app/shared/Model/Collections.js'

export function useGenericCollectionsSubscription<TInput, TOutput, TErrorShape>(
	store: GenericCollectionsStore<TOutput>,
	procedure: DecorateSubscriptionProcedure<{
		input: TInput
		output: AsyncIterable<CollectionBase<TOutput>[], never, any>
		transformer: false
		errorShape: TErrorShape
	}>,
	input: TInput
): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		procedure.subscriptionOptions(input, {
			onStarted: () => {
				// TODO - clear on termination?
				setReady(true)
				store.resetCollections([])
			},
			onData: (data) => {
				// TODO - should this debounce?

				store.resetCollections(data)
			},
		})
	)

	return ready
}
