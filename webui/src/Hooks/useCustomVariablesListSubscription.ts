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
			.emitPromise('custom-variables2:subscribe', [])
			.then((variables) => {
				store.resetCustomVariables(variables)
				setReady(true)
			})
			.catch((e) => {
				console.error('Failed to load CustomVariables list:', e)
				store.resetCustomVariables(null)
			})

		const unsubUpdates = socket.on('custom-variables2:update', (change) => {
			store.applyCustomVariablesChange(change)
		})

		return () => {
			store.resetCustomVariables(null)

			unsubUpdates()

			socket.emitPromise('custom-variables2:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe to custom-variables definitions list', e)
			})
		}
	}, [socket, store])

	return ready
}
