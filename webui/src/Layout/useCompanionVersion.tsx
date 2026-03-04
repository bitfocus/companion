import { useQuery } from '@tanstack/react-query'
import { trpc } from '~/Resources/TRPC'

export interface CompanionVersion {
	versionName: string
	versionSubheading: string
}

/*
 *  Get Companion Version info
 */
export function useCompanionVersion(): CompanionVersion {
	const versionInfo = useQuery(trpc.appInfo.version.queryOptions())

	let versionName = ''
	let versionSubheading = ''

	if (versionInfo.data) {
		if (versionInfo.data.appBuild.includes('-stable-')) {
			versionName = `v${versionInfo.data.appVersion}`
		} else {
			// split appBuild into parts.
			const splitPoint = versionInfo.data.appBuild.indexOf('-')
			if (splitPoint === -1) {
				versionName = `v${versionInfo.data.appBuild}`
			} else {
				versionName = `v${versionInfo.data.appBuild.substring(0, splitPoint)}`
				versionSubheading = versionInfo.data.appBuild.substring(splitPoint + 1)
			}
		}
	}

	return { versionName, versionSubheading }
}
