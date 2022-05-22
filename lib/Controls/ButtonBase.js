import ControlBase from './ControlBase.js'
import Registry from '../Registry.js'
import { ParseControlId, rgb } from '../Resources/Util.js'

export default class ButtonControlBase extends ControlBase {
	/**
	 * The defaults for the bank fields
	 * @type {Object}
	 * @access public
	 * @static
	 */
	static DefaultFields = {
		text: '',
		size: 'auto',
		png: null,
		alignment: 'center:center',
		pngalignment: 'center:center',
		color: rgb(255, 255, 255),
		bgcolor: rgb(0, 0, 0),
		relative_delay: false,
	}

	//

	action_sets = {}

	bank_status = 'good'

	addAction(setId, actionItem) {
		if (this.action_sets[setId] === undefined) {
			// cant implicitly create a set
			this.logger.silly(`Missing set ${this.controlId}:${setId}`)
			return false
		}

		this.action_sets[setId].push(actionItem)

		const instance = this.instance.moduleHost.getChild(actionItem.instance)
		if (instance) {
			instance.actionUpdate(actionItem, page, bank).catch((e) => {
				this.logger.silly(`action_update to connection failed: ${e.message}`)
			})
		}

		this.commitChange(false)

		this.checkBankStatus()
	}

	/**
	 * Remove an action from this control
	 * @param {string} id the id of the action
	 * @returns {boolean} success
	 */
	removeAction(setId, id) {
		const action_set = this.action_sets[setId]
		if (action_set) {
			const index = action_set.findIndex((fb) => fb.id === id)
			if (index !== -1) {
				const action = action_set[index]
				action_set.splice(index, 1)

				this.cleanupAction(action)

				this.commitChange(false)

				this.checkBankStatus()

				return true
			}
		}

		return false
	}

	cleanupAction(action) {
		// Inform relevant module
		const instance = this.instance.moduleHost.getChild(action.instance)
		if (instance) {
			instance.actionDelete(action).catch((e) => {
				this.logger.silly(`action_delete to connection failed: ${e.message}`)
			})
		}
	}

	setActionDelay(setId, id, delay) {
		const action_set = this.action_sets[setId]
		if (action_set) {
			for (const action of action_set) {
				if (action && action.id === id) {
					delay = Number(delay)
					if (isNaN(delay)) delay = 0

					action.delay = delay

					this.commitChange(false)

					return true
				}
			}
		}

		return false
	}

	setActionOption(setId, id, key, value) {
		const action_set = this.action_sets[setId]
		if (action_set) {
			for (const action of action_set) {
				if (action && action.id === id) {
					if (!action.options) action.options = {}

					action.options[key] = value

					// Inform relevant module
					const parsedId = ParseControlId(this.controlId)
					const instance = this.instance.moduleHost.getChild(action.instance)
					if (instance) {
						instance.actionUpdate(action, parsedId?.page, parsedId?.bank).catch((e) => {
							this.logger.silly(`action_update to connection failed: ${e.message}`)
						})
					}

					this.commitChange(false)

					return true
				}
			}
		}

		return false
	}

	/**
	 * Reorder an action in the list
	 * @param {string} setId the action_set id
	 * @param {number} oldIndex the index of the action to move
	 * @param {number} newIndex the target index of the action
	 * @returns {boolean} success
	 */
	reorderAction(setId, oldIndex, newIndex) {
		const action_set = this.action_sets[setId]
		if (action_set) {
			oldIndex = clamp(oldIndex, 0, this.action_set.length)
			newIndex = clamp(newIndex, 0, this.action_set.length)
			this.action_set.splice(newIndex, 0, ...this.action_set.splice(oldIndex, 1))
		}

		this.commitChange()
	}

	/**
	 * Check the status of a bank, and re-draw if needed
	 * @param {boolean} redraw whether to perform a draw
	 * @returns {boolean} whether the status changed
	 * @access protected
	 */
	checkBankStatus(redraw = true) {
		// Find all the instances referenced by the bank
		const instance_ids = new Set()
		for (const actions in Object.values(this.action_sets)) {
			for (const action of actions) {
				instance_ids.add(action.instance)
			}
		}

		// Figure out the combined status
		let status = 'good'
		for (const instance_id of instance_ids) {
			const instance_status = this.instance.getInstanceStatus(instance_id)
			if (instance_status) {
				// TODO - can this be made simpler
				switch (instance_status.category) {
					case 'error':
						status = 'error'
						break
					case 'warning':
						if (status !== 'error') {
							status = 'warning'
						}
						break
				}
			}
		}

		// If the status has changed, emit the eent
		if (status != this.bank_status) {
			this.bank_status = status
			if (redraw) this.triggerRedraw()
			return true
		} else {
			return false
		}
	}
}
