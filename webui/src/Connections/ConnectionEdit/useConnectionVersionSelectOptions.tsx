import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import semver from 'semver'
import { DropdownChoiceInt } from '~/LocalVariableDefinitions.js'
import { useModuleStoreInfo, useModuleUpgradeToVersions } from '~/Modules/ModuleManagePanel.js'
import { useComputed } from '~/util.js'
import { getLatestVersion } from './VersionUtil.js'

export function useConnectionVersionSelectOptions(
	moduleId: string | undefined,
	installedInfo: ClientModuleInfo | null | undefined,
	includeBeta: boolean
): DropdownChoiceInt[] {
	const moduleStoreInfo = useModuleStoreInfo(moduleId)
	const upgradeToVersions = useModuleUpgradeToVersions(moduleId)

	const latestStableVersion = getLatestVersion(moduleStoreInfo?.versions, false)
	const latestBetaVersion = getLatestVersion(moduleStoreInfo?.versions, true)

	return useComputed(() => {
		const choices: DropdownChoiceInt[] = []

		const listedVersions = new Set<string>()
		if (installedInfo) {
			for (const version of installedInfo.installedVersions) {
				if (!includeBeta && version.isBeta) continue

				let label = version.displayName
				if (latestStableVersion && latestStableVersion.id === version.versionId) {
					label += ' (Latest stable)'
				}

				choices.push({ value: version.versionId, label })
				listedVersions.add(version.versionId)
			}
		}

		if (
			latestStableVersion &&
			!listedVersions.has(latestStableVersion.id) &&
			(!installedInfo?.stableVersion ||
				semver.compare(latestStableVersion.id, installedInfo.stableVersion.versionId) > 0)
		) {
			choices.push({ value: latestStableVersion.id, label: `v${latestStableVersion.id} (Install latest stable)` })
		}

		if (
			includeBeta &&
			latestBetaVersion &&
			!listedVersions.has(latestBetaVersion.id) &&
			(!installedInfo?.betaVersion || semver.compare(latestBetaVersion.id, installedInfo.betaVersion.versionId) > 0)
		) {
			choices.push({
				value: latestBetaVersion.id,
				label: `v${latestBetaVersion.id} (Install latest beta)`,
			})
		}

		choices.sort((a, b) => semver.compare(String(b.value), String(a.value)))

		if (installedInfo?.devVersion) choices.unshift({ value: 'dev', label: 'Dev version' })

		const replacementChoices: DropdownChoiceInt[] = []
		// Push the potential replacements first
		for (const upgradeTo of upgradeToVersions) {
			if (upgradeTo.versionId) {
				replacementChoices.push({
					value: `${upgradeTo.moduleId}@${upgradeTo.versionId}`,
					label: `${upgradeTo.displayName} (v${upgradeTo.versionId})`,
				})
			} else {
				replacementChoices.push({
					value: `${upgradeTo.moduleId}@`,
					label: `${upgradeTo.displayName} (Latest stable)`,
				})
			}
		}

		return [...replacementChoices, ...choices]
	}, [installedInfo, upgradeToVersions, latestStableVersion, latestBetaVersion, includeBeta])
}
