import type { DataStoreBase } from '../StoreBase.js'
import type { Logger } from '../../Log/Controller.js'
import { nanoid } from 'nanoid'
import { cloneDeep } from 'lodash-es'
import type { ExportPageContentv4, SomeExportv4 } from '@companion-app/shared/Model/ExportModelv4.js'
import type {
	ExportFullv6,
	ExportPageContentv6,
	ExportPageModelv6,
	ExportTriggerContentv6,
	ExportTriggersListv6,
	SomeExportv6,
} from '@companion-app/shared/Model/ExportModel.js'

/**
 * do the database upgrades to convert from the v4 to the v5 format
 */
function convertDatabaseToV6(db: DataStoreBase<any>, _logger: Logger) {
	if (!db.store) return

	const controlsTable = db.getTableView('controls')

	for (const [controlId, control] of Object.entries(controlsTable.all())) {
		// Note - this doesn't need to consider 'children', as they are not used in the v5 format

		const relativeDelay = control?.options?.relativeDelay
		if (relativeDelay !== undefined) delete control.options.relativeDelay

		// Button controls
		for (const step of Object.values<any>(control.steps || {})) {
			for (const [setId, set] of Object.entries<any>(step.action_sets || {})) {
				step.action_sets[setId] = convertActionsDelay(set, relativeDelay)
			}
		}

		// Triggers
		for (const [setId, set] of Object.entries<any>(control.action_sets || {})) {
			control.action_sets[setId] = convertActionsDelay(set, relativeDelay)
		}

		controlsTable.set(controlId, control)
	}
}

function convertImportToV6(obj: SomeExportv4): SomeExportv6 {
	if (obj.type == 'full') {
		const newObj: ExportFullv6 = { ...cloneDeep(obj), version: 6 }

		if (newObj.pages) {
			for (const page of Object.values(newObj.pages)) {
				convertPageActionsDelays(page)
			}
		}

		if (newObj.triggers) {
			newObj.triggers = convertTriggersDelays(newObj.triggers)
		}

		return newObj
	} else if (obj.type == 'page') {
		const newObj: ExportPageModelv6 = { ...cloneDeep(obj), version: 6 }

		convertPageActionsDelays(newObj.page)

		return newObj
	} else if (obj.type == 'trigger_list') {
		const newObj: ExportTriggersListv6 = { ...cloneDeep(obj), version: 6 }

		newObj.triggers = convertTriggersDelays(newObj.triggers)

		return newObj
	} else {
		// No change
		return obj
	}
}

function convertPageActionsDelays(page: ExportPageContentv4): ExportPageContentv6 {
	for (const row of Object.values(page.controls)) {
		if (!row) continue
		for (const control of Object.values(row)) {
			if (!control?.steps) continue

			for (const step of Object.values<any>(control.steps)) {
				if (!step?.action_sets) continue
				for (const [setId, set] of Object.entries<any>(step.action_sets)) {
					if (!set) continue
					step.action_sets[setId] = convertActionsDelay(set, control.options?.relativeDelay)
				}
			}

			if (control.options) {
				delete control.options.relativeDelay
			}
		}
	}

	return page
}

function convertTriggersDelays(
	triggers: Record<string, ExportTriggerContentv6>
): Record<string, ExportTriggerContentv6> {
	for (const trigger of Object.values<any>(triggers)) {
		for (const [id, action_set] of Object.entries<any>(trigger.action_sets)) {
			trigger.action_sets[id] = convertActionsDelay(action_set, trigger.options?.relativeDelay)
		}

		if (trigger.options) {
			delete trigger.options?.relativeDelay
		}
	}

	return triggers
}

function convertActionsDelay(actions: any[], relativeDelays: boolean | undefined): any[] {
	if (relativeDelays) {
		const newActions: any[] = []

		for (const action of actions) {
			const delay = Number(action.delay)
			delete action.delay

			// Add the wait action
			if (!isNaN(delay) && delay > 0) {
				newActions.push(createWaitAction(delay))
			}

			newActions.push(action)
		}

		return newActions
	} else {
		let currentDelay = 0
		let currentDelayGroupChildren: any[] = []

		let delayGroups: any[] = [wrapActionsInGroup(currentDelayGroupChildren)]

		for (const action of actions) {
			const delay = Number(action.delay)
			delete action.delay

			if (!isNaN(delay) && delay >= 0 && delay !== currentDelay) {
				// action has different delay to the last one
				if (delay > currentDelay) {
					// delay is greater than the last one, translate it to a relative delay
					currentDelayGroupChildren.push(createWaitAction(delay - currentDelay))
				} else {
					// delay is less than the last one, preserve the weird order
					currentDelayGroupChildren = []
					if (delay > 0) currentDelayGroupChildren.push(createWaitAction(delay))
					delayGroups.push(wrapActionsInGroup(currentDelayGroupChildren))
				}

				currentDelay = delay
			}

			currentDelayGroupChildren.push(action)
		}

		if (delayGroups.length > 1) {
			// Weird delay ordering was found, preserve it
			return delayGroups
		} else {
			// Order was incrementing, don't add the extra group layer
			return currentDelayGroupChildren
		}
	}
}

function wrapActionsInGroup(actions: any[]): any {
	return {
		id: nanoid(),
		instance: 'internal',
		action: 'action_group',
		options: {
			execution_mode: 'concurrent',
		},
		children: {
			default: actions,
		},
	}
}
function createWaitAction(delay: number): any {
	return {
		id: nanoid(),
		instance: 'internal',
		action: 'wait',
		options: {
			time: delay,
		},
	}
}

export default {
	upgradeStartup: convertDatabaseToV6,
	upgradeImport: convertImportToV6,
}
