import type { NewClientModuleInfo, NewClientModuleVersionInfo2 } from '@companion-app/shared/Model/ModuleInfo.js'
import type { DevModuleVersionInfo, ReleaseModuleVersionInfo, SomeModuleVersionInfo } from './Types.js'
import semver from 'semver'
import { compact } from 'lodash-es'

/**
 * Information about a module
 */
export class InstanceModuleInfo {
	id: string

	replacedByIds: string[] = []

	devModule: DevModuleVersionInfo | null = null

	installedVersions: Record<string, ReleaseModuleVersionInfo | undefined> = {}

	constructor(id: string) {
		this.id = id
	}

	getVersion(versionId: string | null): SomeModuleVersionInfo | null {
		if (versionId === 'dev') return this.devModule

		if (versionId === null) return null // TODO - is this correct?

		return this.installedVersions[versionId] ?? null
	}

	getLatestVersion(isPrerelease: boolean): ReleaseModuleVersionInfo | null {
		let latest: ReleaseModuleVersionInfo | null = null
		for (const version of Object.values(this.installedVersions)) {
			if (!version || version.isPrerelease !== isPrerelease) continue
			if (!latest || semver.compare(version.display.version, latest.display.version) > 0) {
				latest = version
			}
		}

		return latest
	}

	toClientJson(): NewClientModuleInfo | null {
		const stableVersion = this.getLatestVersion(false)
		const prereleaseVersion = this.getLatestVersion(true)

		const baseVersion = stableVersion ?? prereleaseVersion ?? Object.values(this.installedVersions)[0]
		if (!baseVersion) return null

		return {
			baseInfo: baseVersion.display,

			devVersion: translateStableVersion(this.devModule),

			stableVersion: translateStableVersion(stableVersion),
			prereleaseVersion: translateStableVersion(prereleaseVersion),

			installedVersions: compact(Object.values(this.installedVersions)).map(translateReleaseVersion),
		}
	}
}

function translateStableVersion(version: SomeModuleVersionInfo | null): NewClientModuleVersionInfo2 | null {
	if (!version) return null
	if (version.type === 'dev') {
		return {
			displayName: 'Dev',
			isLegacy: false,
			isDev: true,
			isPrerelease: false,
			hasHelp: version.helpPath !== null,
			versionId: 'dev',
		}
	} else if (version.type === 'release') {
		return {
			displayName: `Latest ${version.isPrerelease ? 'Prerelease' : 'Stable'} (v${version.versionId})`,
			isLegacy: version.display.isLegacy ?? false,
			isDev: false,
			hasHelp: version.helpPath !== null,
			isPrerelease: version.isPrerelease,
			versionId: version.versionId,
		}
	}
	return null
}

function translateReleaseVersion(version: ReleaseModuleVersionInfo): NewClientModuleVersionInfo2 {
	return {
		displayName: `v${version.versionId}`,
		isLegacy: version.display.isLegacy ?? false,
		isDev: false,
		isPrerelease: version.isPrerelease,
		hasHelp: version.helpPath !== null,
		versionId: version.versionId,
	}
}
