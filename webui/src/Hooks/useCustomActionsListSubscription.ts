import { useSubscription } from '@trpc/tanstack-react-query'
import { useState } from 'react'
import { trpc } from '~/Resources/TRPC'
import type { CustomActionsListStore } from '~/Stores/CustomActionsListStore'

export function useCustomActionsListSubscription(
	store: CustomActionsListStore,
	setLoadError?: ((error: string | null) => void) | undefined
): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		trpc.controls.customActions.watch.subscriptionOptions(undefined, {
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
				setLoadError?.(`Failed to load custom actions list: ${error.message}`)
				console.error('Failed to load custom actions list:', error)
				store.updateDefinitions(null)
			},
		})
	)

	return ready
}
