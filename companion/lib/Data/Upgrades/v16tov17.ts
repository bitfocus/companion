import { getDefaultPinnedProperties } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import type {
	ExportFullv6,
	ExportPageModelv6,
	ExportTriggersListv6,
	SomeExportv6,
} from '@companion-app/shared/Model/ExportModel.js'
import type { Logger } from '../../Log/Controller.js'
import type { DataStoreBase } from '../StoreBase.js'

/**
 * Give every existing style element the default pinned properties for its type, so buttons made before
 * pinning existed land on a populated pinned view rather than an empty one.
 *
 * The canvas is skipped: it holds button-level properties, which are not pinnable.
 */
function migrateElements(elements: any[]): void {
	if (!Array.isArray(elements)) return

	for (const element of elements) {
		if (!element || typeof element !== 'object' || element.type === 'canvas') continue

		if (!Array.isArray(element.pinnedProperties)) {
			element.pinnedProperties = getDefaultPinnedProperties(element.type)
		}

		// Recurse into group children
		if (Array.isArray(element.children)) migrateElements(element.children)
	}
}

/**
 * Every control which carries a layered style, including the caches a preset reference keeps of its source.
 */
function migrateControl(control: any): void {
	migrateElements(control?.style?.layers ?? [])
}

function convertDatabaseToV17(db: DataStoreBase<any>, _logger: Logger): void {
	if (!db.store) return

	const controls = db.getTableView('controls')
	for (const [controlId, control] of Object.entries(controls.all())) {
		if (!Array.isArray(control?.style?.layers)) continue

		const cloned = structuredClone(control)
		migrateControl(cloned)
		controls.set(controlId, cloned)
	}
}

function migrateExportPages(pages: any): void {
	if (!pages) return
	for (const page of Object.values(pages) as any) {
		for (const row of Object.values(page.controls) as any) {
			for (const control of Object.values(row)) {
				migrateControl(control)
			}
		}
	}
}

function convertImportToV17(obj: SomeExportv6, _logger: Logger): SomeExportv6 {
	if (obj.type === 'full') {
		const newObj: ExportFullv6 = { ...structuredClone(obj), version: 17 }
		migrateExportPages(newObj.pages)
		return newObj
	} else if (obj.type === 'page') {
		const newObj: ExportPageModelv6 = { ...structuredClone(obj), version: 17 }
		for (const row of Object.values(newObj.page.controls)) {
			for (const control of Object.values(row)) {
				migrateControl(control)
			}
		}
		return newObj
	} else if (obj.type === 'trigger_list') {
		const newObj: ExportTriggersListv6 = { ...structuredClone(obj), version: 17 }
		return newObj
	} else {
		return obj
	}
}

export default {
	upgradeStartup: convertDatabaseToV17,
	upgradeImport: convertImportToV17,
}
