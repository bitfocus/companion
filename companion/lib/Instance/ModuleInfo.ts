import type { NewClientModuleInfo, NewClientModuleVersionInfo2 } from '@companion-app/shared/Model/ModuleInfo.js'
import type { SomeModuleVersionInfo } from './Types.js'
import semver from 'semver'
import { compact } from 'lodash-es'
import { isModuleApiVersionCompatible } from '@companion-app/shared/ModuleApiVersionCheck.js'

/**
 * Information about a module
 */
export class InstanceModuleInfo {
	id: string

	replacedByIds: string[] = []

	devModule: SomeModuleVersionInfo | null = null

	installedVersions: Record<string, SomeModuleVersionInfo | undefined> = {}

	constructor(id: string) {
		this.id = id
	}

	getVersion(versionId: string | null): SomeModuleVersionInfo | null {
		if (versionId === 'dev') return this.devModule

		if (versionId === null) return null // TODO - is this correct?

		return this.installedVersions[versionId] ?? null
	}

	getLatestVersion(isBeta: boolean): SomeModuleVersionInfo | null {
		let latest: SomeModuleVersionInfo | null = null
		for (const version of Object.values(this.installedVersions)) {
			if (!version || version.isBeta !== isBeta) continue
			if (!isModuleApiVersionCompatible(version.manifest.runtime.apiVersion)) continue
			if (!latest || semver.compare(version.display.version, latest.display.version) > 0) {
				latest = version
			}
		}

		return latest
	}

	toClientJson(): NewClientModuleInfo | null {
		const stableVersion = this.getLatestVersion(false)
		const betaVersion = this.getLatestVersion(true)

		const baseVersion = stableVersion ?? betaVersion ?? Object.values(this.installedVersions)[0]
		if (!baseVersion) return null

		return {
			baseInfo: baseVersion.display,

			devVersion: translateStableVersion(this.devModule),

			stableVersion: translateStableVersion(stableVersion),
			betaVersion: translateStableVersion(betaVersion),

			installedVersions: compact(Object.values(this.installedVersions)).map(translateReleaseVersion),
		}
	}
}

function translateStableVersion(version: SomeModuleVersionInfo | null): NewClientModuleVersionInfo2 | null {
	if (!version) return null
	if (version.versionId === 'dev') {
		return {
			displayName: 'Dev',
			isLegacy: false,
			isBeta: false,
			hasHelp: version.helpPath !== null,
			versionId: 'dev',
		}
	} else {
		return {
			displayName: `Latest ${version.isBeta ? 'Beta' : 'Stable'} (v${version.versionId})`,
			isLegacy: version.display.isLegacy ?? false,
			hasHelp: version.helpPath !== null,
			isBeta: version.isBeta,
			versionId: version.versionId,
		}
	}
}

function translateReleaseVersion(version: SomeModuleVersionInfo): NewClientModuleVersionInfo2 {
	return {
		displayName: `v${version.versionId}`,
		isLegacy: version.display.isLegacy ?? false,
		isBeta: version.isBeta,
		hasHelp: version.helpPath !== null,
		versionId: version.versionId,
	}
}
