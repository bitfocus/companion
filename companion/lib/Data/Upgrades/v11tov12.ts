import type { DataStoreBase } from '../StoreBase.js'
import type { Logger } from '../../Log/Controller.js'
import { cloneDeep } from 'lodash-es'
import type {
	ExportFullv6,
	ExportPageModelv6,
	ExportTriggersListv6,
	SomeExportv6,
} from '@companion-app/shared/Model/ExportModel.js'
import type {
	NormalButtonSteps,
	LayeredButtonModel,
	LayeredButtonOptions,
} from '@companion-app/shared/Model/ButtonModel.js'
import type { Complete } from '@companion-module/base'
import { ConvertLegacyStyleToElements } from '../../Resources/ConvertLegacyStyleToElements.js'
import type { SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'

interface NormalButtonModel {
	readonly type: 'button'

	options: NormalButtonOptions

	style: ButtonStyleProperties

	feedbacks: SomeEntityModel[]

	steps: NormalButtonSteps

	localVariables: SomeEntityModel[]
}
interface NormalButtonOptions {
	stepProgression: 'auto' | 'manual' | 'expression'
	stepExpression?: string
	rotaryActions: boolean
}

/**
 * do the database upgrades to convert from the v9 to the v10 format
 */
function convertDatabaseToV12(db: DataStoreBase<any>, _logger: Logger): void {
	if (!db.store) return

	const controls = db.getTableView('controls')

	for (const [controlId, control] of Object.entries(controls.all())) {
		if (control.type === 'button') {
			// Fixup control
			controls.set(controlId, convertControlToLayered(control))
		}
	}
}

function convertControlToLayered(control: NormalButtonModel): LayeredButtonModel {
	return {
		type: 'button-layered',
		options: {
			...(control.options as Complete<NormalButtonOptions>),
			canModifyStyleInApis: true, // Backwards compatibility
		} satisfies Complete<LayeredButtonOptions>,
		localVariables: control.localVariables,
		steps: control.steps,
		...ConvertLegacyStyleToElements(control.style, control.feedbacks),
	}
}

function convertImportToV12(obj: SomeExportv6): SomeExportv6 {
	if (obj.type == 'full') {
		const newObj: ExportFullv6 = {
			...cloneDeep(obj),
			version: 12,
		}

		if (newObj.pages) {
			for (const page of Object.values(newObj.pages)) {
				for (const row of Object.values(page.controls)) {
					for (const [key, control] of Object.entries(row)) {
						if (control.type === 'button') {
							// Fixup control
							row[key as any] = convertControlToLayered(control as NormalButtonModel)
						}
					}
				}
			}
		}

		return newObj
	} else if (obj.type == 'page') {
		const newObj: ExportPageModelv6 = {
			...cloneDeep(obj),
			version: 12,
		}

		for (const row of Object.values(newObj.page.controls)) {
			for (const [key, control] of Object.entries(row)) {
				if (control.type === 'button') {
					// Fixup control
					row[key as any] = convertControlToLayered(control as NormalButtonModel)
				}
			}
		}

		return newObj
	} else if (obj.type == 'trigger_list') {
		const newObj: ExportTriggersListv6 = {
			...cloneDeep(obj),
			version: 12,
		}

		return newObj
	} else {
		// No change
		return obj
	}
}

export default {
	upgradeStartup: convertDatabaseToV12,
	upgradeImport: convertImportToV12,
}
