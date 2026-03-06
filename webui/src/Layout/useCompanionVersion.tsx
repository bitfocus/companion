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

function formatBrowserString(parser: UAParser.IResult): string {
	const browserName = parser.browser.name || 'Unknown Browser'
	const browserVersion = parser.browser.version || 'Unknown Version'
	const browserOS = `${parser.os.name} ${parser.os.version ?? ''}`
	return `${browserName} v${browserVersion} running on: ${browserOS}`
}

/*
 *  Get Companion Version info
 */
export function useCompanionVersion(): CompanionVersion {
	// 1. Companion Version info
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

	// 2. Browser Info
	const [browserString, setBrowserString] = useState(formatBrowserString(new UAParser().getResult()))

	useEffect(() => {
		const parser = new UAParser()
		// Asynchronous call to get accurate version via Client Hints
		const fetchFullSpecs = async () => {
			// withClientHints() returns a Promise with more accurate data that
			// usually distinguishes Windows 11 from 10 (doesn't seem to work with Firefox)
			const result = await parser.getResult().withClientHints()
			setBrowserString(formatBrowserString(result))
		}

		fetchFullSpecs().catch(console.error)
	}, []) // Run once on mount

	// 3. Server OS info:
	const osString = versionInfo.data?.os ?? 'unknown'

	return { versionName, versionBuild, browser: browserString, os: osString }
}
