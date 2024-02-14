import CoreBase from '../../Core/Base.js'
import { cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'

/**
 * @typedef {import('../../Shared/Model/ActionModel.js').ActionInstance} ActionInstance
 */

/**
 * Helper for ControlTypes with actions
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.0.0
 * @abstract
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
export default class FragmentActions extends CoreBase {
	/**
	 * The action-sets on this button
	 * @type {import('../../Shared/Model/ActionModel.js').ActionSetsModel}
	 * @access public
	 */
	action_sets = {}

	/**
	 * @type {import('../../Shared/Model/ActionModel.js').ActionStepOptions}
	 * @access public
	 */
	options

	/**
	 * Commit changes to the database and disk
	 * @type {(redraw?: boolean) => void}
	 * @access private
	 */
	#commitChange

	/**
	 * @param {import('../../Registry.js').default} registry - the application core
	 * @param {string} controlId - id of the control
	 * @param {(redraw?: boolean) => void} commitChange
	 */
	constructor(registry, controlId, commitChange) {
		super(registry, 'fragment-actions', 'Controls/Fragments/Actions')

		this.controlId = controlId
		this.#commitChange = commitChange
	}

	/**
	 * Add an action to this control
	 * @param {string} setId
	 * @param {ActionInstance} actionItem
	 * @returns {boolean} success
	 * @access public
	 */
	actionAdd(setId, actionItem) {
		const action_set = this.action_sets[setId]
		if (!action_set) {
			// cant implicitly create a set
			this.logger.silly(`Missing set ${this.controlId}:${setId}`)
			return false
		}

		action_set.push(actionItem)

		this.#actionSubscribe(actionItem)

		this.#commitChange(false)
		return true
	}

	/**
	 * Append some actions to this button
	 * @param {string} setId the action_set id to update
	 * @param {ActionInstance[]} newActions actions to append
	 * @access public
	 */
	actionAppend(setId, newActions) {
		const action_set = this.action_sets[setId]
		if (action_set) {
			// Add new actions
			for (const action of newActions) {
				action_set.push(action)

				this.#actionSubscribe(action)
			}

			this.#commitChange(false)

			return true
		}

		return false
	}

	/**
	 * Clear/remove all the actions in a set on this control
	 * @param {string} setId
	 * @returns {boolean} success
	 * @access public
	 */
	actionClearSet(setId, skipCommit = false) {
		const action_set = this.action_sets[setId]
		if (action_set) {
			for (const action of action_set) {
				this.cleanupAction(action)
			}

			this.action_sets[setId] = []

			if (!skipCommit) this.#commitChange()

			return true
		}

		return false
	}

	/**
	 * Duplicate an action on this control
	 * @param {string} setId
	 * @param {string} id
	 * @returns {boolean} success
	 * @access public
	 */
	actionDuplicate(setId, id) {
		const action_set = this.action_sets[setId]
		if (action_set) {
			const index = action_set.findIndex((act) => act.id === id)
			if (index !== -1) {
				const actionItem = cloneDeep(action_set[index])
				actionItem.id = nanoid()

				action_set.splice(index + 1, 0, actionItem)

				this.#actionSubscribe(actionItem)

				this.#commitChange(false)

				return true
			}
		}

		return false
	}

	/**
	 * Enable or disable an action
	 * @param {string} setId
	 * @param {string} id
	 * @param {boolean} enabled
	 * @returns {boolean}
	 * @access public
	 */
	actionEnabled(setId, id, enabled) {
		const action_set = this.action_sets[setId]
		if (action_set) {
			for (const action of action_set) {
				if (action && action.id === id) {
					if (!action.options) action.options = {}

					action.disabled = !enabled

					// Inform relevant module
					if (!action.disabled) {
						this.#actionSubscribe(action)
					} else {
						this.cleanupAction(action)
					}

					this.#commitChange(false)

					return true
				}
			}
		}

		return false
	}

	/**
	 * Set action headline
	 * @param {string} setId
	 * @param {string} id
	 * @param {string} headline
	 * @returns {boolean}
	 * @access public
	 */
	actionHeadline(setId, id, headline) {
		const action_set = this.action_sets[setId]
		if (action_set) {
			for (const action of action_set) {
				if (action && action.id === id) {
					action.headline = headline

					this.#commitChange(false)

					return true
				}
			}
		}

		return false
	}

	/**
	 * Learn the options for an action, by asking the instance for the current values
	 * @param {string} setId the id of the action set
	 * @param {string} id the id of the action
	 * @returns {Promise<boolean>} success
	 * @access public
	 */
	async actionLearn(setId, id) {
		const action_set = this.action_sets[setId]
		if (action_set) {
			const action = action_set.find((act) => act.id === id)
			if (action) {
				const instance = this.instance.moduleHost.getChild(action.instance)
				if (instance) {
					const newOptions = await instance.actionLearnValues(action, this.controlId)
					if (newOptions) {
						/** @type {ActionInstance} */
						const newAction = {
							...action,
							options: newOptions,
						}

						// It may not still exist, so do a replace through the usual flow
						return this.actionReplace(newAction)
					}
				}
			}
		}

		return false
	}

	/**
	 * Remove an action from this control
	 * @param {string} setId the id of the action set
	 * @param {string} id the id of the action
	 * @returns {boolean} success
	 * @access public
	 */
	actionRemove(setId, id) {
		const action_set = this.action_sets[setId]
		if (action_set) {
			const index = action_set.findIndex((act) => act.id === id)
			if (index !== -1) {
				const action = action_set[index]
				action_set.splice(index, 1)

				this.cleanupAction(action)

				this.#commitChange(false)

				return true
			}
		}

		return false
	}

	/**
	 * Replace a action with an updated version
	 * @param {Pick<ActionInstance, 'id' | 'action' | 'options'>} newProps
	 * @access public
	 */
	actionReplace(newProps, skipNotifyModule = false) {
		for (const action_set of Object.values(this.action_sets)) {
			if (!action_set) continue

			for (const action of action_set) {
				// Replace the new action in place
				if (action.id === newProps.id) {
					action.action = newProps.action // || newProps.actionId nocommit
					action.options = newProps.options

					delete action.upgradeIndex

					// Inform relevant module
					if (!skipNotifyModule) {
						this.#actionSubscribe(action)
					}

					this.#commitChange(false)

					return true
				}
			}
		}

		return false
	}

	/**
	 * Replace all the actions in a set
	 * @param {string} setId the action_set id to update
	 * @param {ActionInstance[]} newActions actions to populate
	 * @access public
	 */
	actionReplaceAll(setId, newActions) {
		const oldActionSet = this.action_sets[setId]
		if (oldActionSet) {
			// Remove the old actions
			for (const action of oldActionSet) {
				this.cleanupAction(action)
			}

			/** @type {ActionInstance[]} */
			const newActionSet = []
			this.action_sets[setId] = newActionSet

			// Add new actions
			for (const action of newActions) {
				newActionSet.push(action)

				this.#actionSubscribe(action)
			}

			this.#commitChange(false)

			return true
		}

		return false
	}

	/**
	 * Set the delay of an action
	 * @param {string} setId the action_set id
	 * @param {string} id the action id
	 * @param {number} delay the desired delay
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetDelay(setId, id, delay) {
		const action_set = this.action_sets[setId]
		if (action_set) {
			for (const action of action_set) {
				if (action && action.id === id) {
					delay = Number(delay)
					if (isNaN(delay)) delay = 0

					action.delay = delay

					this.#commitChange(false)

					return true
				}
			}
		}

		return false
	}

	/**
	 * Set an opton of an action
	 * @param {string} setId the action_set id
	 * @param {string} id the action id
	 * @param {string} key the desired option to set
	 * @param {any} value the new value of the option
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetOption(setId, id, key, value) {
		const action_set = this.action_sets[setId]
		if (action_set) {
			for (const action of action_set) {
				if (action && action.id === id) {
					if (!action.options) action.options = {}

					action.options[key] = value

					// Inform relevant module
					this.#actionSubscribe(action)

					this.#commitChange(false)

					return true
				}
			}
		}

		return false
	}

	/**
	 * Inform the instance of an updated action
	 * @param {ActionInstance} action the action which changed
	 * @returns {void}
	 * @access private
	 */
	#actionSubscribe(action) {
		if (!action.disabled) {
			const instance = this.instance.moduleHost.getChild(action.instance, true)
			if (instance) {
				instance.actionUpdate(action, this.controlId).catch((/** @type {any} */ e) => {
					this.logger.silly(`action_update to connection failed: ${e.message}`)
				})
			}
		}
	}

	/**
	 * Inform the instance of a removed action
	 * @param {ActionInstance} action the action being removed
	 * @returns {void}
	 * @access protected
	 */
	cleanupAction(action) {
		// Inform relevant module
		const instance = this.instance.moduleHost.getChild(action.instance, true)
		if (instance) {
			instance.actionDelete(action).catch((/** @type {any} */ e) => {
				this.logger.silly(`action_delete to connection failed: ${e.message}`)
			})
		}
	}

	/**
	 * Prepare this control for deletion
	 * @returns {void}
	 * @access public
	 */
	destroy() {
		// Inform modules of action cleanup
		for (const action_set of Object.values(this.action_sets)) {
			if (!action_set) continue

			for (const action of action_set) {
				this.cleanupAction(action)
			}
		}
	}

	/**
	 * Remove any actions referencing a specified connectionId
	 * @param {string} connectionId
	 * @returns {boolean}
	 * @access public
	 */
	forgetConnection(connectionId) {
		let changed = false

		// Cleanup any actions
		for (const [setId, action_set] of Object.entries(this.action_sets)) {
			if (!action_set) continue

			const newActions = []
			for (const action of action_set) {
				if (action.instance === connectionId) {
					this.cleanupAction(action)
					changed = true
				} else {
					newActions.push(action)
				}
			}

			this.action_sets[setId] = newActions
		}

		return changed
	}

	/**
	 * Get all the actions contained here
	 * @access public
	 * @returns {ActionInstance[]}
	 */
	getAllActions() {
		/** @type {ActionInstance[]} */
		const actions = []

		for (const action_set of Object.values(this.action_sets)) {
			if (!action_set) continue
			actions.push(...action_set)
		}

		return actions
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 * @returns {Promise<void>}
	 * @access protected
	 */
	async postProcessImport() {
		/** @type {Promise<any>[]} */
		const ps = []

		for (const action_set of Object.values(this.action_sets)) {
			if (!action_set) continue
			for (let i = 0; i < action_set.length; i++) {
				const action = action_set[i]
				action.id = nanoid()

				if (action.instance === 'internal') {
					const newAction = this.internalModule.actionUpgrade(action, this.controlId)
					if (newAction) {
						action_set[i] = newAction
					}
				} else {
					const instance = this.instance.moduleHost.getChild(action.instance, true)
					if (instance) {
						ps.push(instance.actionUpdate(action, this.controlId))
					}
				}
			}
		}

		await Promise.all(ps).catch((e) => {
			this.logger.silly(`postProcessImport for ${this.controlId} failed: ${e.message}`)
		})
	}

	/**
	 * Prune all actions/feedbacks referencing unknown connections
	 * Doesn't do any cleanup, as it is assumed that the connection has not been running
	 * @param {Set<string>} knownConnectionIds
	 * @returns {boolean} Whether any changes were made
	 * @access public
	 */
	verifyConnectionIds(knownConnectionIds) {
		let changed = false

		// Clean out actions
		for (const [setId, existing_set] of Object.entries(this.action_sets)) {
			if (!existing_set) continue

			const lengthBefore = existing_set.length
			const filtered_set = (this.action_sets[setId] = existing_set.filter(
				(action) => !!action && knownConnectionIds.has(action.instance)
			))
			changed = changed || filtered_set.length !== lengthBefore
		}

		return changed
	}
}
