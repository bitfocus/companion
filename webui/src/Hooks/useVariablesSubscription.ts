import { useState } from 'react'
import type { VariablesStore } from '~/Stores/VariablesStore.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'

export function useVariablesSubscription(
	store: VariablesStore,
	setLoadError?: ((error: string | null) => void) | undefined
): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		trpc.variables.definitions.watch.subscriptionOptions(undefined, {
			onStarted: () => {
				setLoadError?.(null)
				store.updateDefinitions(null)
				setReady(false)
			},
			onData: (data) => {
				setLoadError?.(null)
				store.updateDefinitions(data)
				setReady(true)
			},
			onError: (error) => {
				setLoadError?.(`Failed to load variable definitions: ${error.message}`)
				console.error('Failed to load variable definitions:', error)
				store.updateDefinitions(null)
			},
		})
	)

	return ready
}
