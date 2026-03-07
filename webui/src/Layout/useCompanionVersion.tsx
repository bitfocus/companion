import { useQuery } from '@tanstack/react-query'
import { trpc } from '~/Resources/TRPC'
import Bowser from 'bowser'
import { useEffect, useState } from 'react'

export interface CompanionVersion {
	versionName: string
	versionBuild: string
	os: string
	browser: string
}

// Define advanced types. Alt: install 'user-agent-data-types' for official definitions
interface NavigatorUAData {
	readonly brands: Array<{ brand: string; version: string }>
	readonly mobile: boolean
	readonly platform: string
	getHighEntropyValues(hints: string[]): Promise<{
		architecture?: string
		model?: string
		platformVersion?: string
		fullVersionList?: Array<{ brand: string; version: string }>
	}>
}

// Extend the global Navigator interface
interface CustomNavigator extends Navigator {
	userAgentData?: NavigatorUAData
}

function browserOS(parser: Bowser.Parser.Parser, hints?: any) {
	const os = parser.getOS()

	let osName = os.name || 'Unknown OS'

	// Handle Windows 11 Detection
	if (osName === 'Windows' && hints?.platformVersion) {
		const majorVersion = parseInt(hints.platformVersion.split('.')[0])
		if (majorVersion >= 13) {
			// Optionally map platformVersion to a friendly build (e.g., 22H2)
			osName = `Windows 11 (Build ${hints.platformVersion})`
		} else {
			osName = 'Windows 10'
		}
	}

	return osName
}

function formatBrowserString(parser: Bowser.Parser.Parser, hints?: any): string {
	const browserName = parser.getBrowser().name || 'Unknown Browser'
	let browserVersion = parser.getBrowser().version || 'Unknown Version'
	if (hints?.fullVersionList) {
		// Look for the specific brand that matches what Bowser identified
		const match = hints.fullVersionList.find(
			(item: any) => item.brand.includes(browserName) || browserName.includes(item.brand)
		)
		if (match) {
			browserVersion = match.version
		}
	}
	const browserOsString = browserOS(parser, hints)
	// note: hints.model may equal ''
	const browserPlatform =
		hints?.model || parser.getPlatform().model || parser.getPlatform().type || 'unknown platform (desktop?)'
	// could add hints.architecture
	return `${browserName} v${browserVersion} running OS: ${browserOsString} on: ${browserPlatform}${hints ? '' : ' (not precise)'}`
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
	// For more accurate data use userAgentData, we can either add the types globally or just do this:
	// userAgentData is sometimes called "Client Hints"
	const uaData1 = (navigator as any).userAgentData
	const parser1 = Bowser.getParser(window.navigator.userAgent, uaData1)
	const [browserString, setBrowserString] = useState(formatBrowserString(parser1))

	// now try getting "high-entropy" version info
	useEffect(() => {
		let isMounted = true // prevent running if component is unmounted

		async function fetchDetailedInfo() {
			const ua = window.navigator.userAgent
			const nav = navigator as CustomNavigator
			let hints = null

			// 1. Fetch High Entropy Values if supported (Chromium)
			if (nav.userAgentData?.getHighEntropyValues) {
				try {
					// probably could skip 'architecture' for now...
					hints = await nav.userAgentData.getHighEntropyValues([
						'architecture',
						'model',
						'platformVersion',
						'fullVersionList',
					])
				} catch (e) {
					console.warn('Hints rejected, falling back to basic UA', e)
				}
			}

			// 2. Initialize Bowser with the best available data
			if (hints && isMounted) {
				const parser = Bowser.getParser(ua, hints)
				setBrowserString(formatBrowserString(parser, hints))
			}
		}

		void fetchDetailedInfo()

		return () => {
			isMounted = false
		}
	}, []) // run once on mount

	// 3. Server OS info:
	const osString = versionInfo.data?.os ?? 'unknown'

	return { versionName, versionBuild, browser: browserString, os: osString }
}
