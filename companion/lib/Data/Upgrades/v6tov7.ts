import type { DataStoreBase } from '../StoreBase.js'
import type { Logger } from '../../Log/Controller.js'
import { cloneDeep } from 'lodash-es'
import type { SomeExportv4 } from '@companion-app/shared/Model/ExportModelv4.js'
import type {
	ExportControlv6,
	ExportFullv6,
	ExportPageContentv6,
	ExportPageModelv6,
	ExportTriggersListv6,
	SomeExportv6,
} from '@companion-app/shared/Model/ExportModel.js'
import { ActionEntityModel, EntityModelType, FeedbackEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import { Complete } from '@companion-module/base/dist/util.js'

/**
 * do the database upgrades to convert from the v6 to the v7 format
 */
function convertDatabaseToV7(db: DataStoreBase, _logger: Logger) {
	if (!db.store) return

	const controls = db.getTable('controls')

	for (const [controlId, control] of Object.entries(controls)) {
		// Fixup control
		fixupControlEntities(control)

		db.setTableKey('controls', controlId, control)
	}
}

function convertImportToV7(obj: SomeExportv4): SomeExportv6 {
	if (obj.type == 'full') {
		const newObj: ExportFullv6 = { ...cloneDeep(obj), version: 6 }
		if (newObj.pages) {
			for (const page of Object.values(newObj.pages)) {
				convertPageControls(page)
			}
		}
		if (newObj.triggers) {
			for (const trigger of Object.values<any>(newObj.triggers)) {
				fixupControlEntities(trigger)
			}
		}
		return newObj
	} else if (obj.type == 'page') {
		const newObj: ExportPageModelv6 = { ...cloneDeep(obj), version: 6 }
		convertPageControls(newObj.page)
		return newObj
	} else if (obj.type == 'trigger_list') {
		const newObj: ExportTriggersListv6 = { ...cloneDeep(obj), version: 6 }
		for (const trigger of Object.values<any>(newObj.triggers)) {
			fixupControlEntities(trigger)
		}
		return newObj
	} else {
		// No change
		return obj
	}
}

function fixupControlEntities(control: ExportControlv6): void {
	if (control.type === 'button') {
		for (const step of Object.values<any>(control.steps || {})) {
			for (const [setId, set] of Object.entries<any>(step.action_sets || {})) {
				if (!set) continue
				step.action_sets[setId] = set.map(fixupAction)
			}
		}

		control.feedbacks = control.feedbacks?.map(fixupFeedback) ?? []
	} else if (control.type === 'trigger') {
		if (control.action_sets?.[0]) {
			control.actions = control.action_sets[0].map(fixupAction)
			delete control.action_sets
		} else {
			control.actions = []
		}

		control.condition = control.condition?.map(fixupFeedback) ?? []
	} else {
		// Unknown control type!
	}
}

interface OldFeedbackInstance {
	id: string
	instance_id: string
	headline?: string
	type: string
	options: Record<string, any>
	disabled?: boolean
	upgradeIndex?: number
	isInverted?: boolean
	style?: Partial<ButtonStyleProperties>

	children?: OldFeedbackInstance[]
}
function fixupFeedback(feedback: OldFeedbackInstance): Complete<FeedbackEntityModel> {
	return {
		type: EntityModelType.Feedback,

		id: feedback.id,
		definitionId: feedback.type,
		connectionId: feedback.instance_id,
		headline: feedback.headline,
		options: feedback.options,
		disabled: feedback.disabled,
		upgradeIndex: feedback.upgradeIndex,

		children:
			feedback.instance_id === 'internal' && feedback.children
				? {
						default: feedback.children.map(fixupFeedback),
					}
				: undefined,

		isInverted: feedback.isInverted,
		style: feedback.style,
	}
}

interface OldActionInstance {
	id: string
	instance: string
	headline?: string
	action: string
	options: Record<string, any>
	disabled?: boolean
	upgradeIndex?: number

	/**
	 * Some internal actions can have children, one or more set of them
	 */
	children?: Record<string, OldActionInstance[] | undefined>
}
function fixupAction(action: OldActionInstance): Complete<ActionEntityModel> {
	return {
		type: EntityModelType.Action,

		id: action.id,
		definitionId: action.action,
		connectionId: action.instance,
		headline: action.headline,
		options: action.options,
		disabled: action.disabled,
		upgradeIndex: action.upgradeIndex,

		children:
			action.instance === 'internal' && action.children
				? Object.fromEntries(Object.entries(action.children).map(([id, actions]) => [id, actions?.map(fixupAction)]))
				: undefined,
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
	upgradeStartup: convertDatabaseToV7,
	upgradeImport: convertImportToV7,
}
