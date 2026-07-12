import type { SomeExportv6 } from '@companion-app/shared/Model/ExportModel.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import type { Logger } from '../../Log/Controller.js'
import type { DataStoreBase } from '../StoreBase.js'

/**
 * Replace the boolean `remove_topbar` userconfig field with the richer `buttons_decoration`
 * enum (`topbar` | `border` | `none`), matching the range supported per-button by the canvas element.
 *
 * The old boolean was lossy: `remove_topbar=true` rendered as a border-when-pushed decoration
 * (not "no decoration"), so the behaviour-preserving mapping is:
 * - `remove_topbar === false` -> `'topbar'`
 * - `remove_topbar === true`  -> `'border'`
 *
 * Exports do not carry userconfig, so only the startup (database) path has anything to migrate.
 */
function convertDatabaseToV16(db: DataStoreBase<any>, _logger: Logger): void {
	if (!db.store) return

	const userconfig = db.defaultTableView.getOrDefault('userconfig', {}) as Record<string, any>

	// Only migrate if the old field is present and the new one hasn't already been set
	if (userconfig.buttons_decoration === undefined && 'remove_topbar' in userconfig) {
		userconfig.buttons_decoration = userconfig.remove_topbar ? 'border' : 'topbar'
	}
	delete userconfig.remove_topbar

	db.defaultTableView.set('userconfig', userconfig)
}

function convertImportToV16(obj: SomeExportv6, _logger: Logger, _userConfig: UserConfigModel): SomeExportv6 {
	// Exports do not include userconfig, so there is nothing to transform beyond the version bump.
	return { ...structuredClone(obj), version: 16 }
}

export default {
	upgradeStartup: convertDatabaseToV16,
	upgradeImport: convertImportToV16,
}
