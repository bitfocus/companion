import type {
	ModuleVersionMode,
	NewClientModuleInfo,
	NewClientModuleVersionInfo2,
	NewClientModuleVersionInfo2Ext,
} from '@companion-app/shared/Model/ModuleInfo.js'
import type {
	CustomModuleVersionInfo,
	DevModuleVersionInfo,
	ReleaseModuleVersionInfo,
	SomeModuleVersionInfo,
} from './Types.js'
import semver from 'semver'
import { compact } from 'lodash-es'

/**
 * Information about a module
 */
export class InstanceModuleInfo {
	id: string

	replacedByIds: string[] = []

	devModule: DevModuleVersionInfo | null = null

	releaseVersions: Record<string, ReleaseModuleVersionInfo | undefined> = {}
	customVersions: Record<string, CustomModuleVersionInfo | undefined> = {}

	constructor(id: string) {
		this.id = id
	}

	getVersion(versionMode: ModuleVersionMode, versionId: string | null): SomeModuleVersionInfo | null {
		switch (versionMode) {
			case 'stable': {
				if (this.devModule) return this.devModule

				let latest: ReleaseModuleVersionInfo | null = null
				for (const version of Object.values(this.releaseVersions)) {
					if (!version || version.releaseType !== 'stable') continue
					if (!latest || semver.compare(version.display.version, latest.display.version) > 0) {
						latest = version
					}
				}

				return latest
			}
			case 'prerelease': {
				if (this.devModule) return this.devModule

				let latest: ReleaseModuleVersionInfo | null = null
				for (const version of Object.values(this.releaseVersions)) {
					if (!version || version.releaseType !== 'prerelease') continue
					if (!latest || semver.compare(version.display.version, latest.display.version) > 0) {
						latest = version
					}
				}

				return latest
			}
			case 'specific-version':
				return versionId ? (this.releaseVersions[versionId] ?? null) : null
			case 'custom':
				return versionId ? (this.customVersions[versionId] ?? null) : null
			default:
				return null
		}
	}

	toClientJson(): NewClientModuleInfo | null {
		const stableVersion = this.getVersion('stable', null)
		const prereleaseVersion = this.getVersion('prerelease', null)

		const baseVersion =
			stableVersion ??
			prereleaseVersion ??
			Object.values(this.releaseVersions)[0] ??
			Object.values(this.customVersions)[0]
		if (!baseVersion) return null

		return {
			baseInfo: baseVersion.display,

			hasDevVersion: !!this.devModule,

			stableVersion: translateStableVersion(stableVersion),
			prereleaseVersion: translatePrereleaseVersion(prereleaseVersion),

			releaseVersions: compact(Object.values(this.releaseVersions)).map(translateReleaseVersion),
			customVersions: compact(Object.values(this.customVersions)).map(translateCustomVersion),
		}
	}
}

function translateStableVersion(version: SomeModuleVersionInfo | null): NewClientModuleVersionInfo2Ext | null {
	if (!version) return null
	if (version.type === 'dev') {
		return {
			displayName: 'Latest Stable (Dev)',
			isLegacy: false,
			isDev: true,
			isBuiltin: false,
			hasHelp: version.helpPath !== null,
			version: {
				mode: 'stable',
				id: null,
			},
			versionId: 'dev',
		}
	} else if (version.type === 'release') {
		return {
			displayName: `Latest Stable (v${version.versionId})`,
			isLegacy: version.display.isLegacy ?? false,
			isDev: false,
			isBuiltin: version.isBuiltin,
			hasHelp: version.helpPath !== null,
			version: {
				mode: 'stable',
				id: null,
			},
			versionId: version.versionId,
		}
	}
	return null
}

function translatePrereleaseVersion(version: SomeModuleVersionInfo | null): NewClientModuleVersionInfo2Ext | null {
	if (!version) return null
	if (version.type === 'dev') {
		return {
			displayName: 'Latest Prerelease (Dev)',
			isLegacy: false,
			isDev: true,
			isBuiltin: false,
			hasHelp: version.helpPath !== null,
			version: {
				mode: 'prerelease',
				id: null,
			},
			versionId: 'dev',
		}
	} else if (version.type === 'release') {
		return {
			displayName: `Latest Prerelease (v${version.versionId})`,
			isLegacy: version.display.isLegacy ?? false,
			isDev: false,
			isBuiltin: version.isBuiltin,
			hasHelp: version.helpPath !== null,
			version: {
				mode: 'prerelease',
				id: null,
			},
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
		isBuiltin: version.isBuiltin,
		hasHelp: version.helpPath !== null,
		version: {
			mode: 'specific-version',
			id: version.versionId,
		},
	}
}

function translateCustomVersion(version: CustomModuleVersionInfo): NewClientModuleVersionInfo2 {
	return {
		displayName: `Custom XXX v${version.versionId}`,
		isLegacy: false,
		isDev: false,
		isBuiltin: false,
		hasHelp: version.helpPath !== null,
		version: {
			mode: 'custom',
			id: version.versionId,
		},
	}
}
