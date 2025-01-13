import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '../util.js'
import type { VariablesStore } from '../Stores/VariablesStore.js'

export function useCustomVariablesSubscription(
	socket: CompanionSocketWrapped,
	store: VariablesStore,
	setLoadError?: ((error: string | null) => void) | undefined,
	retryToken?: string
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		setLoadError?.(null)
		store.resetCustomVariables(null)
		setReady(false)

		socket
			.emitPromise('custom-variables:subscribe', [])
			.then((customVariables) => {
				setLoadError?.(null)
				store.resetCustomVariables(customVariables)
				setReady(true)
			})
			.catch((e) => {
				setLoadError?.(`Failed to load custom-variables list`)
				console.error('Failed to load custom-variables list:', e)
				store.resetCustomVariables(null)
			})

		const unsubUpdates = socket.on('custom-variables:update', (changes) => {
			store.applyCustomVariablesChanges(changes)
		})

		return () => {
			store.resetCustomVariables(null)

			unsubUpdates()

			socket.emitPromise('custom-variables:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe to custom-variables list', e)
			})
		}
	}, [socket, store, setLoadError, retryToken])

	return ready
}
