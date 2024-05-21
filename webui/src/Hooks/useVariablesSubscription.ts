import { useEffect, useState } from 'react'
import { CompanionSocketType, socketEmitPromise } from '../util.js'
import type { VariablesStore } from '../Stores/VariablesStore.js'
import { VariableDefinitionUpdate } from '@companion-app/shared/Model/Variables.js'

export function useVariablesSubscription(
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

		socketEmitPromise(socket, 'variable-definitions:subscribe', [])
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

		const updateVariables = (label: string, change: VariableDefinitionUpdate | null) => {
			store.applyVariablesChange(label, change)
		}

		socket.on('variable-definitions:update', updateVariables)

		return () => {
			store.resetCustomVariables(null)

			socket.off('variable-definitions:update', updateVariables)

			socketEmitPromise(socket, 'variable-definitions:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe to variable-definitions list', e)
			})
		}
	}, [socket, store, setLoadError, retryToken])

	return ready
}
