import type { DataStoreBase } from '../StoreBase.js'
import type { Logger } from '../../Log/Controller.js'
import { nanoid } from 'nanoid'

/**
 * do the database upgrades to convert from the v4 to the v5 format
 */
function convertDatabaseToV6(db: DataStoreBase, _logger: Logger) {
	if (!db.store) return

	const controls = db.getTable('controls')

	for (const [controlId, control] of Object.entries(controls)) {
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

		db.setTableKey('controls', controlId, control)
	}
}

function convertImportToV6(obj: any) {
	// TODO - process with convertActionsDelay

	return obj
}

function convertActionsDelay(actions: any[], relativeDelays: boolean | undefined) {
	const newActions: any[] = []

	if (relativeDelays) {
		let currentParent = newActions

		for (const action of actions) {
			const delay = Number(action.delay)
			delete action.delay

			if (!delay || isNaN(delay)) {
				currentParent.push(action)
			} else {
				let newParent: any[] = [action]
				currentParent.push({
					id: nanoid(),
					instance: 'internal',
					action: 'action_group',
					options: {
						delay: delay,
					},

					children: newParent,
				})
				currentParent = newParent
			}
		}
	} else {
		for (const action of actions) {
			const delay = Number(action.delay)
			delete action.delay

			if (!delay || isNaN(delay)) {
				newActions.push(action)
			} else {
				newActions.push({
					id: nanoid(),
					instance: 'internal',
					action: 'action_group',
					options: {
						delay: delay,
					},

					children: [action],
				})
			}
		}
	}

	return newActions
}

export default {
	upgradeStartup: convertDatabaseToV6,
	upgradeImport: convertImportToV6,
}
