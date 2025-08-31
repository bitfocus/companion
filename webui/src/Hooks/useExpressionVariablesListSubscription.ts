import { useState } from 'react'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'
import type { ExpressionVariablesListStore } from '~/Stores/ExpressionVariablesListStore'

export function useExpressionVariablesListSubscription(
	store: ExpressionVariablesListStore,
	setLoadError?: ((error: string | null) => void) | undefined
): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		trpc.controls.expressionVariables.watch.subscriptionOptions(undefined, {
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
				setLoadError?.(`Failed to load expression-variables list: ${error.message}`)
				console.error('Failed to load expression-variables list:', error)
				store.updateDefinitions(null)
			},
		})
	)

	return ready
}
