import type { ActionInstance, ActionSetId, ActionSetsModel } from '@companion-app/shared/Model/ActionModel.js'
import { FragmentActionList } from './FragmentActionList.js'
import { validateActionSetId } from '@companion-app/shared/ControlId.js'

/**
 * Helper for ControlTypes with actions
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.0.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
export class FragmentActions {
	/**
	 * The action-sets on this button
	 */
	#actions: Map<ActionSetId, FragmentActionList> = new Map()

	/**
	 * Commit changes to the database and disk
	 */
	readonly #commitChange: (redraw?: boolean) => void

	/**
	 * Initialise from storage
	 * @param actions
	 * @param skipSubscribe Whether to skip calling subscribe for the new feedbacks
	 * @param isCloned Whether this is a cloned instance
	 */
	loadStorage(actions: ActionSetsModel, skipSubscribe?: boolean, isCloned?: boolean) {
		for (const list of this.#actions.values()) {
			list.cleanup()
		}

		this.#actions.clear()

		for (const [key, value] of Object.entries(actions)) {
			if (!value) continue

			const keySafe = validateActionSetId(key as any)
			if (keySafe === undefined) {
				this.#logger.error(`Invalid action set id ${key}`)
				continue
			}

			const newList = new FragmentActionList(
				this.#instanceDefinitions,
				this.#internalModule,
				this.#moduleHost,
				this.#controlId
			)
			newList.loadStorage(value, !!skipSubscribe, !!isCloned)
			this.#actions.set(keySafe, newList)
		}
	}

	getActionSet(setId: ActionSetId): FragmentActionList | undefined {
		return this.#actions.get(setId)
	}

	getActionSetIds(): Array<string | number> {
		return Array.from(this.#actions.keys())
	}

	/**
	 * Replace all the actions in a set
	 * @param setId the action_set id to update
	 * @param newActions actions to populate
	 */
	actionReplaceAll(setId: ActionSetId, newActions: ActionInstance[]): boolean {
		const actionSet = this.#actions.get(setId)
		if (!actionSet) return false

		actionSet.loadStorage(newActions, false, false)

		this.#commitChange(false)

		return true
	}
}
