import { useSubscription } from '@trpc/tanstack-react-query'
import { useCallback } from 'react'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RenderStallBannerView } from './RenderStallBannerView.js'

/** Warns of draws which stalled the renderer, from the server */
export function RenderStallBanner(): React.JSX.Element | null {
	const status = useSubscription(trpc.renderStalls.status.subscriptionOptions())

	const retryMutation = useMutationExt(trpc.renderStalls.retry.mutationOptions())
	const postponeMutation = useMutationExt(trpc.renderStalls.postponeRestart.mutationOptions())
	const restartMutation = useMutationExt(trpc.renderStalls.restartNow.mutationOptions())

	const onRetry = useCallback((key: string) => retryMutation.mutate({ key }), [retryMutation])
	const onPostponeRestart = useCallback(() => postponeMutation.mutate(), [postponeMutation])
	const onRestartNow = useCallback(() => restartMutation.mutate(), [restartMutation])

	if (!status.data) return null

	return (
		<RenderStallBannerView
			status={status.data}
			onRetry={onRetry}
			onPostponeRestart={onPostponeRestart}
			onRestartNow={onRestartNow}
		/>
	)
}
