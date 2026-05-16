import type { SomeExportv6 } from '@companion-app/shared/Model/ExportModel.js'
import type { Logger } from '../../Log/Controller.js'
import type { DataStoreBase } from '../StoreBase.js'

// Snapshot of the plugin config field prefix at the time this migration was introduced
const pluginCfgPrefix = 'plugin_cfg_'

/**
 * Rename map: old stored key -> new stored key.
 *
 * These are point-in-time renames needed when the plugin config namespace
 * (`plugin_cfg_` prefix) was introduced. Keys that previously had no prefix, or
 * had a different prefix, are migrated to their correct stored form here.
 */
const legacyRenames: ReadonlyArray<[oldKey: string, newKey: string]> = [
	['tbarValueVariable', 'transfer_input_tbarValueVariable'],
	['shuttleValueVariable', 'transfer_input_shuttleValueVariable'],
	['jogValueVariable', 'transfer_input_jogValueVariable'],
	['illuminate_pressed', `${pluginCfgPrefix}illuminate_pressed`],
	['tbarLeds', 'transfer_output_tbarLeds'],
	['swipe_can_change_page', 'canChangePage'],
	['nfc', 'transfer_input_nfc'],
	['invertFaderValues', `${pluginCfgPrefix}invertFaderValues`],
	['leftFaderValueVariable', 'transfer_input_leftFaderValueVariable'],
	['rightFaderValueVariable', 'transfer_input_rightFaderValueVariable'],
]

/** Mutates `config` in place. Returns true if any key was renamed. */
function applyRenamesOnConfig(config: Record<string, unknown>): boolean {
	let changed = false
	for (const [oldKey, newKey] of legacyRenames) {
		if (!Object.hasOwn(config, oldKey)) continue
		if (!Object.hasOwn(config, newKey)) {
			config[newKey] = config[oldKey]
		}
		delete config[oldKey]
		changed = true
	}
	return changed
}

/**
 * do the database upgrades to convert from the v11 to the v12 format
 */
function convertDatabaseToV12(db: DataStoreBase<any>, _logger: Logger): void {
	if (!db.store) return

	const surfaces = db.getTableView('surfaces')
	for (const [id, surface] of Object.entries(surfaces.all())) {
		const config: Record<string, unknown> = surface?.config
		if (!config || typeof config !== 'object') continue

		if (applyRenamesOnConfig(config)) surfaces.set(id, surface)
	}
}

function convertImportToV12(obj: SomeExportv6): SomeExportv6 {
	if (obj.type !== 'full' || !obj.surfaces || typeof obj.surfaces !== 'object') {
		return { ...obj, version: 12 as const }
	}

	const newObj = { ...structuredClone(obj), version: 12 as const }
	for (const surface of Object.values(newObj.surfaces as Record<string, any>)) {
		const config: Record<string, unknown> = surface?.config
		if (config && typeof config === 'object') applyRenamesOnConfig(config)
	}
	return newObj
}

export default { upgradeStartup: convertDatabaseToV12, upgradeImport: convertImportToV12 }
