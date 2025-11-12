import { useState } from 'react'
import type { UserConfigStore } from '~/Stores/UserConfigStore.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'
import type { UserConfigUpdate } from '@companion-app/shared/Model/UserConfigModel.js'

export function useUserConfigSubscription(
	store: UserConfigStore,
	setLoadError?: ((error: string | null) => void) | undefined
): {
	ready: boolean
	reset: () => void
} {
	const [ready, setReady] = useState(false)

	const sub = useSubscription(
		trpc.userConfig.watchConfig.subscriptionOptions(undefined, {
			onStarted: () => {
				setLoadError?.(null)
				store.updateStore(null)
				setReady(false)
			},
			onData: (data) => {
				setLoadError?.(null)
				store.updateStore(data as UserConfigUpdate) // TODO - avoid this cast
				setReady(true)
			},
			onError: (error) => {
				console.error('Failed to load user config', error)
				setLoadError?.(`Failed to load user config: ${error.message}`)
				store.updateStore(null)
				setReady(false)
			},
		})
	)

	return { ready, reset: sub.reset }
}
