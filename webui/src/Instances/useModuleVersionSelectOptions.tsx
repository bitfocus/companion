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

	const latestStableVersion = getLatestVersion(moduleType, moduleStoreInfo?.versions, false)
	const latestIncompatibleStableVersion = getLatestVersion(moduleType, moduleStoreInfo?.versions, false, true)
	const latestBetaVersion = getLatestVersion(moduleType, moduleStoreInfo?.versions, true)

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
				// A deprecated version is never offered as the latest, but can already be installed, so say
				// so here too - this is where a user acts on the badge shown in the list
				if (moduleStoreInfo?.versions.find((v) => v.id === version.versionId)?.deprecationReason) {
					label += ' (Deprecated)'
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
		moduleStoreInfo,
		upgradeToVersions,
		latestStableVersion,
		latestBetaVersion,
		includeBeta,
		loaded,
		hasIncompatibleNewerVersion,
	])
}
