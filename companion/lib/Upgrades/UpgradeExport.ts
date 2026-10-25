import type { SomeExportv6 } from '@companion-app/shared/Model/ExportModel.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import LogController, { type Logger } from '../Log/Controller.js'
import { LEGACY_VERSION, legacyUpgrades } from './LegacyUpgrades.js'

const logger = LogController.createLogger('Upgrades/UpgradeExport')

interface ExportUpgradeStep {
	upgradeImport: (obj: any, logger: Logger, userConfig: UserConfigModel) => SomeExportv6
}

/** The steps that upgrade an export, after the legacy steps */
const exportUpgrades: ExportUpgradeStep[] = []

/** The version of the export format */
export const EXPORT_VERSION = LEGACY_VERSION + exportUpgrades.length

/**
 * Upgrade an exported page or full configuration to the latest format
 * @throws if it is from a newer version of Companion
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function upgradeImport(obj: any, userConfig: UserConfigModel): SomeExportv6 {
	const currentVersion = obj.version || 1
	if (currentVersion > EXPORT_VERSION) {
		throw new Error(
			`This file is from a newer version of Companion (export version ${currentVersion}, this supports up to ${EXPORT_VERSION})`
		)
	}

	for (let i = currentVersion; i < EXPORT_VERSION; i++) {
		if (i < LEGACY_VERSION) {
			obj = legacyUpgrades[i - 1].upgradeImport(obj, logger, userConfig)
		} else {
			obj = exportUpgrades[i - LEGACY_VERSION].upgradeImport(obj, logger, userConfig)
		}
	}

	obj.version = EXPORT_VERSION
	return obj
}
