import { observable, ObservableSet } from 'mobx'
import { useEffect, useMemo, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { socketEmitPromise } from '../util'

export function useActiveLearnRequests(socket: Socket): [ObservableSet<string>, boolean] {
	const [isReady, setIsReady] = useState<boolean>(false)
	const activeIds = useMemo(() => observable.set<string>(), [])

	useEffect(() => {
		let aborted = false
		socketEmitPromise(socket, 'controls:subscribe:learn', [])
			.then((active: string[]) => {
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

		const onAdd = (id: string) => activeIds.add(id)
		const onRemove = (id: string) => activeIds.delete(id)

		socket.on('learn:add', onAdd)
		socket.on('learn:remove', onRemove)

		return () => {
			setIsReady(false)
			activeIds.clear()

			aborted = true
			socketEmitPromise(socket, 'controls:unsubscribe:learn', []).catch((e) => {
				console.error('unsubscribe to learn failed', e)
			})

			socket.off('learn:add', onAdd)
			socket.off('learn:remove', onRemove)
		}
	}, [activeIds, socket])

	return [activeIds, isReady]
}
