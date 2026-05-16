import type {
	LayeredButtonModel,
	LayeredButtonOptions,
	NormalButtonSteps,
} from '@companion-app/shared/Model/ButtonModel.js'
import type { SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type {
	ExportFullv6,
	ExportPageModelv6,
	ExportTriggersListv6,
	SomeExportv6,
} from '@companion-app/shared/Model/ExportModel.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import type { Complete } from '@companion-module/base'
import type { Logger } from '../../Log/Controller.js'
import { ConvertLegacyStyleToElements } from '../../Resources/ConvertLegacyStyleToElements.js'
import type { DataStoreBase } from '../StoreBase.js'

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
 * do the database upgrades to convert from the v12 to the v13 format
 */
function convertDatabaseToV13(db: DataStoreBase<any>, _logger: Logger): void {
	if (!db.store) return

	const userconfig = db.defaultTableView.getOrDefault('userconfig', {}) as Partial<UserConfigModel>
	const defaultNoTopBar = !!userconfig.remove_topbar

	const controls = db.getTableView('controls')

	for (const [controlId, control] of Object.entries(controls.all())) {
		if (control.type === 'button') {
			// Fixup control
			controls.set(controlId, convertControlToLayered(control, defaultNoTopBar))
		}
	}
}

function convertControlToLayered(control: NormalButtonModel, defaultNoTopBar: boolean): LayeredButtonModel {
	const parsed = ConvertLegacyStyleToElements(control.style, control.feedbacks, null, defaultNoTopBar)
	return {
		type: 'button-layered',
		options: {
			...(control.options as Complete<NormalButtonOptions>),
			canModifyStyleInApis: true, // Backwards compatibility
		} satisfies Complete<LayeredButtonOptions>,
		localVariables: control.localVariables,
		steps: control.steps,
		feedbacks: parsed.feedbacks,
		style: {
			layers: parsed.layers,
		},
	}
}

function convertImportToV13(obj: SomeExportv6, _logger: Logger, userConfig: UserConfigModel): SomeExportv6 {
	const defaultNoTopBar = !!userConfig.remove_topbar

	if (obj.type == 'full') {
		const newObj: ExportFullv6 = {
			...structuredClone(obj),
			version: 13,
		}

		if (newObj.pages) {
			for (const page of Object.values(newObj.pages)) {
				for (const row of Object.values(page.controls)) {
					for (const [key, control] of Object.entries(row)) {
						if (control.type === 'button') {
							// Fixup control
							row[key as any] = convertControlToLayered(control as NormalButtonModel, defaultNoTopBar)
						}
					}
				}
			}
		}

		return newObj
	} else if (obj.type == 'page') {
		const newObj: ExportPageModelv6 = {
			...structuredClone(obj),
			version: 13,
		}

		for (const row of Object.values(newObj.page.controls)) {
			for (const [key, control] of Object.entries(row)) {
				if (control.type === 'button') {
					// Fixup control
					row[key as any] = convertControlToLayered(control as NormalButtonModel, defaultNoTopBar)
				}
			}
		}

		return newObj
	} else if (obj.type == 'trigger_list') {
		const newObj: ExportTriggersListv6 = {
			...structuredClone(obj),
			version: 13,
		}

		return newObj
	} else {
		// No change
		return obj
	}
}

export default {
	upgradeStartup: convertDatabaseToV13,
	upgradeImport: convertImportToV13,
}
