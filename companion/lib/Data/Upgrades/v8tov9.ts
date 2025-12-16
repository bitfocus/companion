import type { DataStoreBase } from '../StoreBase.js'
import type { Logger } from '../../Log/Controller.js'
import type { SomeExportv4 } from '@companion-app/shared/Model/ExportModelv4.js'
import type {
	ExportControlv6,
	ExportFullv6,
	ExportPageContentv6,
	ExportPageModelv6,
	ExportTriggersListv6,
	SomeExportv6,
} from '@companion-app/shared/Model/ExportModel.js'

/**
 * do the database upgrades to convert from the v8 to the v9 format
 */
function convertDatabaseToV9(db: DataStoreBase<any>, _logger: Logger): void {
	if (!db.store) return

	const controls = db.getTableView('controls')

	for (const [controlId, control] of Object.entries(controls.all())) {
		// Fixup control
		fixupControlEntities(control)

		controls.set(controlId, control)
	}
}

function convertImportToV9(obj: SomeExportv4): SomeExportv6 {
	if (obj.type == 'full') {
		const newObj: ExportFullv6 = {
			companionBuild: undefined,
			...structuredClone(obj),
			version: 9,
		}
		if (newObj.pages) {
			for (const page of Object.values(newObj.pages)) {
				convertPageControls(page)
			}
		}
		return newObj
	} else if (obj.type == 'page') {
		const newObj: ExportPageModelv6 = {
			connectionCollections: undefined,
			companionBuild: undefined,
			...structuredClone(obj),
			version: 9,
		}
		convertPageControls(newObj.page)
		return newObj
	} else if (obj.type == 'trigger_list') {
		const newObj: ExportTriggersListv6 = {
			triggerCollections: undefined,
			connectionCollections: undefined,
			companionBuild: undefined,
			...structuredClone(obj),
			version: 9,
		}
		return newObj
	} else {
		// No change
		return obj
	}
}

function fixupControlEntities(control: ExportControlv6): void {
	if (control.type === 'button') {
		if (!control.options.stepProgression) {
			control.options.stepProgression = control.options.stepAutoProgress ? 'auto' : 'manual'
			delete control.options.stepAutoProgress
		}
	} else if (control.type === 'trigger') {
		// Nothing to do
	} else {
		// Unknown control type!
	}
}

function convertPageControls(page: ExportPageContentv6): ExportPageContentv6 {
	for (const row of Object.values(page.controls)) {
		if (!row) continue
		for (const control of Object.values(row)) {
			fixupControlEntities(control)
		}
	}

	return page
}

export default {
	upgradeStartup: convertDatabaseToV9,
	upgradeImport: convertImportToV9,
}
