import { useEffect, useState } from 'react'
import { CompanionSocketType, socketEmitPromise } from '../util.js'
import type { CustomVariableUpdate } from '@companion-app/shared/Model/CustomVariableModel.js'
import type { VariablesStore } from '../Stores/VariablesStore.js'

export function useCustomVariablesSubscription(
	socket: CompanionSocketType,
	store: VariablesStore,
	setLoadError?: ((error: string | null) => void) | undefined,
	retryToken?: string
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		setLoadError?.(null)
		store.resetCustomVariables(null)
		setReady(false)

		socketEmitPromise(socket, 'custom-variables:subscribe', [])
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

		const updateCustomVariables = (changes: CustomVariableUpdate[]) => {
			store.applyCustomVariablesChanges(changes)
		}

		socket.on('custom-variables:update', updateCustomVariables)

		return () => {
			store.resetCustomVariables(null)

			socket.off('custom-variables:update', updateCustomVariables)

			socketEmitPromise(socket, 'custom-variables:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe to custom-variables list', e)
			})
		}
	}, [socket, store, setLoadError, retryToken])

	return ready
}
