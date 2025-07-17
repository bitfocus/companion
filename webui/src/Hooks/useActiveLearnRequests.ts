import { useSubscription } from '@trpc/tanstack-react-query'
import { type ObservableSet, runInAction } from 'mobx'
import { useState } from 'react'
import { trpc } from '~/TRPC'
import { assertNever } from '~/util'

export function useActiveLearnRequests(activeIds: ObservableSet<string>): boolean {
	const [isReady, setIsReady] = useState<boolean>(false)

	useSubscription(
		trpc.controls.activeLearn.watch.subscriptionOptions(undefined, {
			onStarted: () => {
				runInAction(() => {
					activeIds.clear()
					setIsReady(false)
				})
			},
			onData: (data) => {
				setIsReady(true)
				runInAction(() => {
					switch (data.type) {
						case 'init':
							activeIds.replace(data.ids)
							break
						case 'add':
							activeIds.add(data.id)
							break
						case 'remove':
							activeIds.delete(data.id)
							break
						default:
							assertNever(data)
							break
					}
				})
			},
		})
	)

	return isReady
}
