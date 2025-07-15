import type { DataStoreBase } from '../StoreBase.js'
import type { Logger } from '../../Log/Controller.js'
import { cloneDeep, omit } from 'lodash-es'
import type { CustomVariablesModelv6, SomeExportv6 } from '@companion-app/shared/Model/ExportModelv6.js'
import type {
	ExportFullv10,
	ExportPageModelv10,
	ExportTriggersListv10,
	SomeExportv10,
} from '@companion-app/shared/Model/ExportModel.js'
import type { CustomVariableModel } from '@companion-app/shared/Model/CustomVariableModel.js'
import { nanoid } from 'nanoid'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { CustomVariableOptionDefaultKey } from '../../Controls/CustomVariableConstants.js'

/**
 * do the database upgrades to convert from the v8 to the v9 format
 */
function convertDatabaseToV10(db: DataStoreBase<any>, _logger: Logger): void {
	if (!db.store) return

	// TODO

	// const controls = db.getTableView('controls')

	// for (const [controlId, control] of Object.entries(controls.all())) {
	// 	// Fixup control
	// 	fixupControlEntities(control)

	// 	controls.set(controlId, control)
	// }
}

function convertCustomVariables(oldVariables: CustomVariablesModelv6): Record<string, CustomVariableModel> {
	const newVariables: Record<string, CustomVariableModel> = {}

	for (const [name, definition] of Object.entries(oldVariables)) {
		newVariables[nanoid()] = {
			type: 'custom-variable',
			entity: {
				id: nanoid(),
				type: EntityModelType.Feedback,

				definitionId: 'user_value',
				connectionId: 'internal',
				options: {
					[CustomVariableOptionDefaultKey]: definition.defaultValue,
					persist_value: !!definition.persistCurrentValue,
				},
			},

			options: {
				variableName: name,
				description: definition.description,
				collectionId: definition.collectionId,
				sortOrder: definition.sortOrder || 0,
			},
		}
	}

	return newVariables
}

function convertImportToV10(obj: SomeExportv6): SomeExportv10 {
	if (obj.type == 'full') {
		const newObj: ExportFullv10 = {
			...cloneDeep(omit(obj, 'custom_variables', 'instances', 'pages')),
			pages: obj.pages
				? Object.fromEntries(
						Object.entries(obj.pages).map(([pageId, page]) => [
							pageId,
							{
								...cloneDeep(page),
								id: page.id || nanoid(),
							},
						])
					)
				: undefined,
			customVariables: convertCustomVariables(obj.custom_variables || {}),
			connections: cloneDeep(obj.instances),
			companionBuild: obj.companionBuild || 'Unknown',
			version: 10,
		}

		return newObj
	} else if (obj.type == 'page') {
		const newObj: ExportPageModelv10 = {
			...cloneDeep(omit(obj, 'instances', 'page')),
			page: cloneDeep({ ...obj.page, id: obj.page.id || nanoid() }),
			companionBuild: obj.companionBuild || 'Unknown',
			connections: cloneDeep(obj.instances),
			connectionCollections: cloneDeep(obj.connectionCollections) || [],
			version: 10,
		}
		return newObj
	} else if (obj.type == 'trigger_list') {
		const newObj: ExportTriggersListv10 = {
			...cloneDeep(omit(obj, 'instances')),
			companionBuild: obj.companionBuild || 'Unknown',
			triggerCollections: cloneDeep(obj.triggerCollections) || [],
			connections: cloneDeep(obj.instances),
			connectionCollections: cloneDeep(obj.connectionCollections) || [],
			version: 10,
		}
		return newObj
	} else {
		// No change
		return obj
	}
}

export default {
	upgradeStartup: convertDatabaseToV10,
	upgradeImport: convertImportToV10,
}
