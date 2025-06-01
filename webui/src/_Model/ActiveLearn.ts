import type { ObservableSet } from 'mobx'
import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '~/util.js'

export function useActiveLearnRequests(socket: CompanionSocketWrapped, activeIds: ObservableSet<string>): boolean {
	const [isReady, setIsReady] = useState<boolean>(false)

	useEffect(() => {
		let aborted = false
		socket
			.emitPromise('controls:subscribe:learn', [])
			.then((active) => {
				if (aborted) return
				activeIds.clear()
				for (const id of active) {
					activeIds.add(id)
				}

				setIsReady(true)
			})
			.catch((e) => {
				console.error('subscribe to learn failed', e)
			})

		const unsubAdd = socket.on('learn:add', (id) => activeIds.add(id))
		const unsubRemove = socket.on('learn:remove', (id) => activeIds.delete(id))

		return () => {
			setIsReady(false)
			activeIds.clear()

			aborted = true
			socket.emitPromise('controls:unsubscribe:learn', []).catch((e) => {
				console.error('unsubscribe to learn failed', e)
			})

			unsubAdd()
			unsubRemove()
		}
	}, [activeIds, socket])

	return isReady
}
