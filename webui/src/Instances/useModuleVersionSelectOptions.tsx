import semver from 'semver'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { useModuleStoreInfo } from '~/Modules/useModuleStoreInfo.js'
import { useModuleUpgradeToVersions } from '~/Modules/useModuleUpgradeToVersions.js'
import { useComputed } from '~/Resources/util.js'
import { getLatestVersion } from './VersionUtil.js'

export function useModuleVersionSelectOptions(
	moduleType: ModuleInstanceType,
	moduleId: string | undefined,
	installedInfo: ClientModuleInfo | null | undefined,
	includeBeta: boolean
): {
	loaded: boolean
	hasIncompatibleNewerVersion: boolean
	choices: DropdownChoice[]
} {
	const moduleStoreInfo = useModuleStoreInfo(moduleType, moduleId)
	const upgradeToVersions = useModuleUpgradeToVersions(moduleType, moduleId)

	const latestStableVersion = getLatestVersion(moduleStoreInfo?.versions, false)
	const latestIncompatibleStableVersion = getLatestVersion(moduleStoreInfo?.versions, false, true)
	const latestBetaVersion = getLatestVersion(moduleStoreInfo?.versions, true)

	const loaded = !!moduleStoreInfo
	const hasIncompatibleNewerVersion =
		!!latestIncompatibleStableVersion && latestIncompatibleStableVersion.id !== latestStableVersion?.id

	return useComputed(() => {
		const choices: DropdownChoice[] = []

		const listedVersions = new Set<string>()
		if (installedInfo) {
			for (const version of installedInfo.installedVersions) {
				if (!includeBeta && version.isBeta) continue

				let label = version.displayName
				if (latestStableVersion && latestStableVersion.id === version.versionId) {
					label += ' (Latest stable)'
				}

				choices.push({ id: version.versionId, label })
				listedVersions.add(version.versionId)
			}
		}

		if (
			latestStableVersion &&
			!listedVersions.has(latestStableVersion.id) &&
			(!installedInfo?.stableVersion ||
				semver.compare(latestStableVersion.id, installedInfo.stableVersion.versionId, { loose: true }) > 0)
		) {
			choices.push({ id: latestStableVersion.id, label: `v${latestStableVersion.id} (Install latest stable)` })
		}

		if (
			includeBeta &&
			latestBetaVersion &&
			!listedVersions.has(latestBetaVersion.id) &&
			(!installedInfo?.betaVersion ||
				semver.compare(latestBetaVersion.id, installedInfo.betaVersion.versionId, { loose: true }) > 0)
		) {
			choices.push({
				id: latestBetaVersion.id,
				label: `v${latestBetaVersion.id} (Install latest beta)`,
			})
		}

		choices.sort((a, b) => semver.compare(String(b.id), String(a.id), { loose: true }))

		if (installedInfo?.devVersion) choices.unshift({ id: 'dev', label: 'Dev version' })
		if (installedInfo?.builtinVersion) choices.unshift({ id: 'builtin', label: 'Builtin version' })

		const replacementChoices: DropdownChoice[] = []
		// Push the potential replacements first
		for (const upgradeTo of upgradeToVersions) {
			if (upgradeTo.versionId) {
				replacementChoices.push({
					id: `${upgradeTo.moduleId}@${upgradeTo.versionId}`,
					label: `${upgradeTo.displayName} (v${upgradeTo.versionId})`,
				})
			} else {
				replacementChoices.push({
					id: `${upgradeTo.moduleId}@`,
					label: `${upgradeTo.displayName} (Latest stable)`,
				})
			}
		}

		return {
			choices: [...replacementChoices, ...choices],
			hasIncompatibleNewerVersion,
			loaded,
		}
	}, [
		installedInfo,
		upgradeToVersions,
		latestStableVersion,
		latestBetaVersion,
		includeBeta,
		loaded,
		hasIncompatibleNewerVersion,
	])
}
