import { useQuery } from '@tanstack/react-query'
import { trpc } from '~/Resources/TRPC'
import { UAParser } from 'ua-parser-js'
import { useEffect, useState } from 'react'

export interface CompanionVersion {
	versionName: string
	versionBuild: string
	os: string
	browser: string
}

/*
 *  Get Companion Version info
 */
export function useCompanionVersion(): CompanionVersion {
	const versionInfo = useQuery(trpc.appInfo.version.queryOptions())

	let versionName = ''
	let versionBuild = ''

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
				versionBuild = versionInfo.data.appBuild.substring(splitPoint + 1)
			}
		}
	}

	const [browserString, setBrowserString] = useState<string>('processing...')

	useEffect(() => {
		const parser = new UAParser()
		// Asynchronous call to get accurate version via Client Hints
		const fetchFullSpecs = async () => {
			// 2. withClientHints() returns a Promise with accurate data
			// This is what correctly identifies Windows 11 vs 10
			const result = await parser.getResult().withClientHints()

			const browserName = result.browser.name || 'Unknown Browser'
			const browserVersion = result.browser.version || 'Unknown Version'

			setBrowserString(`${browserName} v${browserVersion} running on: ${result.os.name} ${result.os.version ?? ''}`)
		}

		fetchFullSpecs().catch(console.error)
	}, []) // Run once on mount

	//const betterOS = await parser.getOS().withClientHints()
	//.then(os => {
	//console.log(`Accurate OS: ${os.name} ${os.version}`);

	return { versionName, versionBuild, browser: browserString, os: versionInfo.data?.os ?? 'unknown' }
}
