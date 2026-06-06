import { FONTSIZE_SHRINK_DEFAULT } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import type {
	ExportFullv6,
	ExportPageModelv6,
	ExportTriggersListv6,
	SomeExportv6,
} from '@companion-app/shared/Model/ExportModel.js'
import type { Logger } from '../../Log/Controller.js'
import type { DataStoreBase } from '../StoreBase.js'

function migrateTextElementFontsize(element: any): void {
	if (element?.type !== 'text') return

	const fontsize = element.fontsize
	if (!fontsize || typeof fontsize !== 'object') return

	// Already migrated (fontsizeAllowShrink exists)
	if ('fontsizeAllowShrink' in element) return

	if (fontsize.isExpression) {
		// Expression — keep it; default allowShrink to false since we can't know
		element.fontsizeAllowShrink = { value: false, isExpression: false }
	} else {
		const isAuto = fontsize.value === 'auto' || Number.isNaN(Number(fontsize.value))
		element.fontsize = { value: isAuto ? FONTSIZE_SHRINK_DEFAULT : Number(fontsize.value), isExpression: false }
		element.fontsizeAllowShrink = { value: isAuto, isExpression: false }
	}
}

function migrateLayersArray(layers: any[]): void {
	if (!Array.isArray(layers)) return
	for (const element of layers) {
		migrateTextElementFontsize(element)
		// Recurse into group/composite children
		if (Array.isArray(element?.children)) migrateLayersArray(element.children)
	}
}

function migrateControl(control: any): void {
	if (control?.type !== 'button-layered') return
	migrateLayersArray(control.style?.layers ?? [])
}

function convertDatabaseToV14(db: DataStoreBase<any>, _logger: Logger): void {
	if (!db.store) return

	const controls = db.getTableView('controls')
	for (const [controlId, control] of Object.entries(controls.all())) {
		if (control?.type === 'button-layered') {
			const cloned = structuredClone(control)
			migrateControl(cloned)
			controls.set(controlId, cloned)
		}
	}
}

function migrateExportControls(pages: any): void {
	if (!pages) return
	for (const page of Object.values(pages) as any) {
		for (const row of Object.values(page.controls) as any) {
			for (const control of Object.values(row)) {
				migrateControl(control)
			}
		}
	}
}

function convertImportToV14(obj: SomeExportv6, _logger: Logger): SomeExportv6 {
	if (obj.type === 'full') {
		const newObj: ExportFullv6 = { ...structuredClone(obj), version: 14 }
		migrateExportControls(newObj.pages)
		return newObj
	} else if (obj.type === 'page') {
		const newObj: ExportPageModelv6 = { ...structuredClone(obj), version: 14 }
		for (const row of Object.values(newObj.page.controls)) {
			for (const control of Object.values(row)) {
				migrateControl(control)
			}
		}
		return newObj
	} else if (obj.type === 'trigger_list') {
		const newObj: ExportTriggersListv6 = { ...structuredClone(obj), version: 14 }
		return newObj
	} else {
		return obj
	}
}

export default {
	upgradeStartup: convertDatabaseToV14,
	upgradeImport: convertImportToV14,
}
