import z from 'zod'
import { EXPORT_VERSION, SomeExportSchema, type SomeExport } from '@companion-app/shared/Model/Export/Latest.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import LogController from '../Log/Controller.js'
import { repairExport } from './ExportRepair.js'
import { LEGACY_VERSION, legacyUpgrades } from './LegacyUpgrades.js'

const logger = LogController.createLogger('Upgrades/UpgradeExport')

const MAX_REPAIR_ATTEMPTS = 3

/**
 * Upgrade an exported page or full configuration to the latest format. An export older than the first version with a
 * schema is upgraded by the legacy steps first, then the schema parses it, migrating it from any later version.
 * An entity or element that fails is replaced with a placeholder, and a control or trigger that still fails is skipped
 * @throws if it is from a newer version of Companion, or is otherwise invalid
 */
export function upgradeImport(obj: unknown, userConfig: UserConfigModel): SomeExport {
	let upgraded: any = obj
	const currentVersion = upgraded?.version || 1
	if (typeof currentVersion !== 'number') throw new Error(`Invalid export version: ${String(currentVersion)}`)
	if (currentVersion > EXPORT_VERSION) {
		throw new Error(
			`This file is from a newer version of Companion (export version ${currentVersion}, this supports up to ${EXPORT_VERSION})`
		)
	}

	for (let i = currentVersion; i < LEGACY_VERSION; i++) {
		upgraded = legacyUpgrades[i - 1].upgradeImport(upgraded, logger, userConfig)
	}

	// A repair can reveal more to repair, so it is given a few attempts
	let result = SomeExportSchema.safeParse(upgraded)
	for (let attempt = 0; !result.success && attempt < MAX_REPAIR_ATTEMPTS; attempt++) {
		const repaired = repairExport(upgraded, result.error.issues)
		if (!repaired) break

		for (const repair of repaired.repairs) logger.warn(`Repaired import: ${repair}`)
		upgraded = repaired.obj
		result = SomeExportSchema.safeParse(upgraded)
	}
	if (!result.success) throw new Error(`Invalid export: ${z.prettifyError(result.error)}`)

	return result.data
}
