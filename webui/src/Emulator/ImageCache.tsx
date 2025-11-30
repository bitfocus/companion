import type { TRPCClientErrorLike } from '@trpc/client'
import { type TRPCSubscriptionResult, useSubscription } from '@trpc/tanstack-react-query'
import { observable, runInAction } from 'mobx'
import { useMemo } from 'react'
import { trpc } from '~/Resources/TRPC'

export type GetCachedImage = (x: number, y: number) => string | false | undefined

export function useEmulatorImageCache(
	emulatorId: string,
	enabled: boolean
): { imagesSub: TRPCSubscriptionResult<any, TRPCClientErrorLike<any>>; getImage: GetCachedImage } {
	const imageCache = useMemo(() => observable.map<string, string | false>(), [])
	const imagesSub = useSubscription(
		trpc.surfaces.emulatorImages.subscriptionOptions(
			{ id: emulatorId },
			{
				enabled: enabled,
				onStarted: () => {
					runInAction(() => {
						// Clear the image cache when the subscription starts
						imageCache.clear()
					})
				},
				onData: (data) => {
					runInAction(() => {
						if (data.clearCache) imageCache.clear()

						for (const change of data.images) {
							const key = getCacheKey(change.x, change.y)
							imageCache.set(key, change.buffer)
						}
					})
				},
			}
		)
	)

	const getImage: GetCachedImage = useMemo(() => {
		return (x: number, y: number) => imageCache.get(getCacheKey(x, y))
	}, [imageCache])

	return { imagesSub, getImage }
}
function getCacheKey(x: number, y: number): string {
	return `${x}/${y}`
}
