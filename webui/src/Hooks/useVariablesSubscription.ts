import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '~/util.js'
import type { VariablesStore } from '~/Stores/VariablesStore.js'

export function useVariablesSubscription(
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
			.emitPromise('variable-definitions:subscribe', [])
			.then((variables) => {
				setLoadError?.(null)
				store.resetVariables(variables)
				setReady(true)
			})
			.catch((e) => {
				setLoadError?.(`Failed to load  variable-definitions list`)
				console.error('Failed to load  variable-definitions list:', e)
				store.resetVariables(null)
			})

		const unsubUpdates = socket.on('variable-definitions:update', (label, change) => {
			store.applyVariablesChange(label, change)
		})

		return () => {
			store.resetCustomVariables(null)

			unsubUpdates()

			socket.emitPromise('variable-definitions:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe to variable-definitions list', e)
			})
		}
	}, [socket, store, setLoadError, retryToken])

	return ready
}
