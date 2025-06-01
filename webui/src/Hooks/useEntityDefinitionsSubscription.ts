import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '~/util.js'
import { EntityDefinitionsForTypeStore } from '~/Stores/EntityDefinitionsStore.js'

export function useEntityDefinitionsSubscription(
	socket: CompanionSocketWrapped,
	store: EntityDefinitionsForTypeStore
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		let disposed = false

		const entityType = store.entityType

		store.reset(null)
		setReady(false)

		socket
			.emitPromise('entity-definitions:subscribe', [entityType])
			.then((data) => {
				store.reset(data)
				setReady(true)
			})
			.catch((e) => {
				store.reset(null)
				console.error(`Failed to load ${entityType} definitions list`, e)
			})

		const unsubUpdates = socket.on('entity-definitions:update', (type, change) => {
			if (disposed || type !== entityType) return

			store.applyChanges(change)
		})

		return () => {
			disposed = true

			store.reset(null)
			unsubUpdates()

			socket.emitPromise('entity-definitions:unsubscribe', [entityType]).catch((e) => {
				console.error(`Failed to unsubscribe to ${entityType} definitions list`, e)
			})
		}
	}, [socket, store])

	return ready
}
