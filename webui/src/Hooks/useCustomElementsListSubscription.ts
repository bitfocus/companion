import { useSubscription } from '@trpc/tanstack-react-query'
import { useState } from 'react'
import { trpc } from '~/Resources/TRPC'
import type { CustomElementsListStore } from '~/Stores/CustomElementsListStore'

export function useCustomElementsListSubscription(
	store: CustomElementsListStore,
	setLoadError?: ((error: string | null) => void) | undefined
): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		trpc.controls.customElements.watch.subscriptionOptions(undefined, {
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
				setLoadError?.(`Failed to load custom elements list: ${error.message}`)
				console.error('Failed to load custom elements list:', error)
				store.updateDefinitions(null)
			},
		})
	)

	return ready
}
