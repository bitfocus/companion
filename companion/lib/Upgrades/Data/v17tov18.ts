import type { SomeExportv6 } from '@companion-app/shared/Model/ExportModel.js'
import type { DataStoreBase } from '../../Data/StoreBase.js'
import type { Logger } from '../../Log/Controller.js'

/**
 * Give an existing db the settings it had before each was added, where those differ from what a new config gets.
 * This used to be done by the user config on every load, while it could tell which settings were missing
 */
function migrateUserConfig(db: DataStoreBase<any>, logger: Logger): void {
	const mainTable = db.defaultTableView
	const userconfig: Record<string, any> | undefined = mainTable.get('userconfig')
	if (!userconfig || typeof userconfig !== 'object') return

	// Setup the ports to match how they used to be
	const legacyConfig: Record<string, any> = {
		detailed_data_collection: true,

		tcp_enabled: true,
		tcp_listen_port: 51234,

		udp_enabled: true,
		udp_listen_port: 51235,

		osc_enabled: true,
		osc_listen_port: 12321,

		emberplus_enabled: true,
	}

	// Only if none of these fields have been defined
	if (Object.keys(legacyConfig).every((key) => userconfig[key] === undefined)) {
		logger.info('Running one-time userconfig v2 upgrade')
		Object.assign(userconfig, legacyConfig)
	}

	// Preserve old behaviour
	if (userconfig.usb_hotplug === undefined) {
		userconfig.usb_hotplug = false
	}

	// Enable the legacy OSC, TCP and UDP apis if the service is enabled
	if (userconfig.osc_enabled && userconfig.osc_legacy_api_enabled === undefined) {
		userconfig.osc_legacy_api_enabled = true
	}
	if (userconfig.tcp_enabled && userconfig.tcp_legacy_api_enabled === undefined) {
		userconfig.tcp_legacy_api_enabled = true
	}
	if (userconfig.udp_enabled && userconfig.udp_legacy_api_enabled === undefined) {
		userconfig.udp_legacy_api_enabled = true
	}

	// Enable the http api (both modern and legacy)
	if (userconfig.http_api_enabled === undefined) {
		userconfig.http_api_enabled = true
		userconfig.http_legacy_api_enabled = true
	}

	mainTable.set('userconfig', userconfig)
}

/**
 * Store the cloud uuid as JSON, as every other row is, rather than as a raw string
 */
function migrateCloudUuid(db: DataStoreBase<any>): void {
	if (!db.tableExists('cloud')) return

	// Read it raw, as a uuid of only digits would parse as JSON. The column's numeric affinity also stores one as a number
	const row = db.store.prepare(`SELECT value FROM cloud WHERE id = 'uuid'`).get() as
		{ value: string | number } | undefined
	if (row === undefined) return

	// Already stored as JSON. A raw uuid or machine id can't be a JSON string, as it has no quotes
	if (typeof row.value === 'string' && row.value.startsWith('"')) return

	db.store.prepare(`UPDATE cloud SET value = ? WHERE id = 'uuid'`).run(JSON.stringify(String(row.value)))
}

function convertDatabaseToV18(db: DataStoreBase<any>, logger: Logger): void {
	if (!db.store) return

	migrateUserConfig(db, logger)
	migrateCloudUuid(db)
}

function convertImportToV18(obj: SomeExportv6, _logger: Logger): SomeExportv6 {
	// Exports do not include the cloud table, so there is nothing to transform beyond the version bump.
	return { ...structuredClone(obj), version: 18 }
}

export default {
	upgradeStartup: convertDatabaseToV18,
	upgradeImport: convertImportToV18,
}
