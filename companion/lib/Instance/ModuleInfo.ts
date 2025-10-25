import type { ClientModuleInfo, ClientModuleVersionInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import semver from 'semver'
import { compact } from 'lodash-es'
import type { SomeModuleVersionInfo } from './Types.js'
import { isModuleApiVersionCompatible } from '@companion-app/shared/ModuleApiVersionCheck.js'
import { getHelpPathForInstalledModule } from './ModuleScanner.js'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'

/**
 * Information about a module
 */
export class InstanceModuleInfo {
	readonly moduleType: ModuleInstanceType
	readonly id: string

	devModule: SomeModuleVersionInfo | null = null

	installedVersions: Record<string, SomeModuleVersionInfo | undefined> = {}

	constructor(moduleType: ModuleInstanceType, id: string) {
		this.moduleType = moduleType
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
			if (!latest || semver.compare(version.versionId, latest.versionId) > 0) {
				latest = version
			}
		}

		return latest
	}

	toClientJson(): ClientModuleInfo | null {
		const stableVersion = this.getLatestVersion(false)
		const betaVersion = this.getLatestVersion(true)

		const baseVersion = stableVersion ?? betaVersion ?? Object.values(this.installedVersions)[0] ?? this.devModule
		if (!baseVersion) return null

		return {
			moduleType: this.moduleType,

			display: baseVersion.display,

			devVersion: translateStableVersion(this.devModule),

			stableVersion: translateStableVersion(stableVersion),
			betaVersion: translateStableVersion(betaVersion),

			installedVersions: compact(Object.values(this.installedVersions)).map(translateReleaseVersion),
		}
	}
}

function translateStableVersion(version: SomeModuleVersionInfo | null): ClientModuleVersionInfo | null {
	if (!version) return null
	if (version.versionId === 'dev') {
		return {
			displayName: 'Dev',
			isLegacy: false,
			isBeta: false,
			helpPath: getHelpPathForInstalledModule(version.manifest.id, version.versionId),
			versionId: 'dev',
		}
	} else {
		return {
			displayName: `Latest ${version.isBeta ? 'Beta' : 'Stable'} (v${version.versionId})`,
			isLegacy: version.isLegacy,
			helpPath: getHelpPathForInstalledModule(version.manifest.id, version.versionId),
			isBeta: version.isBeta,
			versionId: version.versionId,
		}
	}
}

function translateReleaseVersion(version: SomeModuleVersionInfo): ClientModuleVersionInfo {
	return {
		displayName: `v${version.versionId}`,
		isLegacy: version.isLegacy,
		isBeta: version.isBeta,
		helpPath: getHelpPathForInstalledModule(version.manifest.id, version.versionId),
		versionId: version.versionId,
	}
}
