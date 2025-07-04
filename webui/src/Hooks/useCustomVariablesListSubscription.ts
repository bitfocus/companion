import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '~/util.js'
import type { CustomVariablesListStore } from '~/Stores/CustomVariablesListStore.js'

export function useCustomVariablesListSubscription(
	socket: CompanionSocketWrapped,
	store: CustomVariablesListStore
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.resetCustomVariables(null)
		setReady(false)

		socket
			.emitPromise('custom-variables:subscribe', [])
			.then((variables) => {
				store.resetCustomVariables(variables)
				setReady(true)
			})
			.catch((e) => {
				console.error('Failed to load CustomVariables list:', e)
				store.resetCustomVariables(null)
			})

		const unsubUpdates = socket.on('custom-variables:update', (change) => {
			store.applyCustomVariablesChange(change)
		})

		return () => {
			store.resetCustomVariables(null)

			unsubUpdates()

			socket.emitPromise('custom-variables:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe to custom-variables definitions list', e)
			})
		}
	}, [socket, store])

	return ready
}
