import type { ExportFullv6, SomeExportv6 } from '@companion-app/shared/Model/ExportModel.js'
import type { Logger } from '../../Log/Controller.js'
import type { DataStoreBase } from '../StoreBase.js'

/**
 * Move the `never_lock` property from the per-surface panel config to the surface group config.
 *
 * Lock state is tracked at the group level, so the lock-eligibility flag belongs there too.
 * For auto-groups (a surface that is its own group) the flag is stored on the surface's own
 * `groupConfig`. For explicit groups the flag is merged onto the shared group config, with a
 * surface that opted out of locking winning (OR merge).
 */
function migrateSurfaces(
	getSurfaces: () => Record<string, any>,
	setSurface: (id: string, config: any) => void,
	getGroup: (id: string) => any,
	setGroup: (id: string, config: any) => void
): void {
	// never_lock values collected from members of explicit groups
	const explicitGroupNeverLock = new Map<string, boolean>()

	for (const [surfaceId, surfaceConfig] of Object.entries(getSurfaces())) {
		if (!surfaceConfig || typeof surfaceConfig !== 'object') continue

		const config = surfaceConfig.config
		if (!config || typeof config !== 'object' || !('never_lock' in config)) continue

		const neverLock = !!config.never_lock
		delete config.never_lock

		if (surfaceConfig.groupId) {
			// Explicit group: merge onto the shared group config later
			explicitGroupNeverLock.set(
				surfaceConfig.groupId,
				(explicitGroupNeverLock.get(surfaceConfig.groupId) ?? false) || neverLock
			)
		} else {
			// Auto-group: store on the surface's own group config
			surfaceConfig.groupConfig = surfaceConfig.groupConfig ?? {}
			surfaceConfig.groupConfig.never_lock = neverLock
		}

		setSurface(surfaceId, surfaceConfig)
	}

	for (const [groupId, neverLock] of explicitGroupNeverLock) {
		const groupConfig = getGroup(groupId)
		if (!groupConfig || typeof groupConfig !== 'object') continue

		groupConfig.never_lock = neverLock
		setGroup(groupId, groupConfig)
	}
}

function convertDatabaseToV15(db: DataStoreBase<any>, _logger: Logger): void {
	if (!db.store) return

	const surfaces = db.getTableView('surfaces')
	const groups = db.getTableView('surface_groups')

	migrateSurfaces(
		() => surfaces.all(),
		(id, config) => surfaces.set(id, config),
		(id) => groups.get(id),
		(id, config) => groups.set(id, config)
	)
}

function convertImportToV15(obj: SomeExportv6, _logger: Logger): SomeExportv6 {
	if (obj.type === 'full') {
		const newObj: ExportFullv6 = { ...structuredClone(obj), version: 15 }

		const surfaces = (newObj.surfaces ?? {}) as Record<string, any>
		const groups = (newObj.surfaceGroups ?? {}) as Record<string, any>

		migrateSurfaces(
			() => surfaces,
			(id, config) => {
				surfaces[id] = config
			},
			(id) => groups[id],
			(id, config) => {
				groups[id] = config
			}
		)

		newObj.surfaces = surfaces
		newObj.surfaceGroups = groups

		return newObj
	} else {
		return { ...structuredClone(obj), version: 15 }
	}
}

export default {
	upgradeStartup: convertDatabaseToV15,
	upgradeImport: convertImportToV15,
}
