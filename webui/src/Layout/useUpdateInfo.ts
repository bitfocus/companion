import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'
import { channelFromVersionBuild } from './updateChannel.js'
import { useCompanionVersion } from './useCompanionVersion'

export interface UpdateInfo {
	message: string
	message2?: string
	link?: string
}

/** The update server's notice (typically "a new version is available"), or `null` when there is none to show */
export function useUpdateInfo(): UpdateInfo | null {
	const { versionBuild } = useCompanionVersion()
	const channel = channelFromVersionBuild(versionBuild)

	const updateData = useSubscription(trpc.appInfo.updateInfo.subscriptionOptions())

	// The update server only knows about released versions, so its "new version available" notice is
	// noise on an experimental (main/feature branch) build.
	if (!updateData.data?.message || channel === 'experimental') return null

	return {
		message: updateData.data.message,
		message2: updateData.data.message2 || undefined,
		link: updateData.data.link || undefined,
	}
}
