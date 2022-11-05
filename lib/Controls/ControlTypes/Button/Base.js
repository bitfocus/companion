import ControlBase from '../../ControlBase.js'
import { ParseControlId, rgb, GetButtonBitmapSize } from '../../../Resources/Util.js'
import { cloneDeep } from 'lodash-es'
import FragmentActions from '../../Fragments/FragmentActions.js'
import FragmentFeedbacks from '../../Fragments/FragmentFeedbacks.js'

/**
 * Abstract class for a editable button control.
 *
 * @extends ControlBase
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
export default class ButtonControlBase extends ControlBase {
	/**
	 * The defaults style for a button
	 * @type {Object}
	 * @access public
	 * @static
	 */
	static DefaultStyle = {
		text: '',
		size: 'auto',
		png: null,
		alignment: 'center:center',
		pngalignment: 'center:center',
		color: rgb(255, 255, 255),
		bgcolor: rgb(0, 0, 0),
		show_topbar: 'default',
	}
	/**
	 * The defaults options for a button
	 * @type {Object}
	 * @access public
	 * @static
	 */
	static DefaultOptions = {
		relativeDelay: false,
	}

	/**
	 * The actions fragment
	 * @access public
	 */
	actions

	/**
	 * The feedbacks fragment
	 * @access public
	 */
	feedbacks

	/**
	 * The current status of this button
	 * @access protected
	 */
	bank_status = 'good'

	/**
	 * The base style of this button
	 * @access protected
	 */
	style = {}

	/**
	 * The config of this button
	 */
	options = {}

	/**
	 * Whether this button has delayed actions running
	 * @access protected
	 */
	has_actions_running = false

	/**
	 * Whether this button is currently pressed
	 * @access protected
	 */
	pushed = false

	constructor(registry, controlId, logSource, debugNamespace) {
		super(registry, controlId, logSource, debugNamespace)

		this.actions = new FragmentActions(
			registry,
			controlId,
			this.commitChange.bind(this),
			this.checkButtonStatus.bind(this)
		)
		this.feedbacks = new FragmentFeedbacks(
			registry,
			controlId,
			this.commitChange.bind(this),
			this.triggerRedraw.bind(this),
			false
		)
	}

	/**
	 * Check the status of a bank, and re-draw if needed
	 * @param {boolean} redraw whether to perform a draw
	 * @returns {boolean} whether the status changed
	 * @access public
	 */
	checkButtonStatus(redraw = true) {
		// Find all the instances referenced by the bank
		const instance_ids = new Set()
		for (const actions in Object.values(this.actions.action_sets)) {
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

	/**
	 * Prepare this control for deletion
	 * @access public
	 */
	destroy() {
		this.actions.destroy()
		this.feedbacks.destroy()

		super.destroy()
	}

	/**
	 * Remove any actions and feedbacks referencing a specified instanceId
	 * @param {string} instanceId
	 * @access public
	 */
	forgetInstance(instanceId) {
		const changedFeedbacks = this.feedbacks.forgetInstance(instanceId)
		const changedActions = this.actions.forgetInstance(instanceId)

		if (changedActions || changedFeedbacks) {
			this.checkButtonStatus(false)

			this.commitChange()
		}
	}

	/**
	 * Get the size of the bitmap render of this control
	 * @access public
	 * @abstract
	 */
	getBitmapSize() {
		return GetButtonBitmapSize(this.registry, this.style)
	}

	/**
	 * Get the complete style object of a button
	 * @returns the processed style of the button
	 * @access public
	 */
	getDrawStyle() {
		let style = this.getUnparsedStyle()

		if (style.text) {
			style.text = this.instance.variable.parseVariables(style.text)
		}

		style.pushed = !!this.pushed
		style.action_running = this.has_actions_running
		style.bank_status = this.bank_status

		style.style = this.type
		return cloneDeep(style)
	}

	/**
	 * Get the unparsed style for a button
	 * Note: Does not clone the style
	 * @returns the unprocessed style
	 * @access public
	 */
	getUnparsedStyle() {
		return {
			...this.style,
			...this.feedbacks.getUnparsedStyleOverrides(),
		}
	}

	/**
	 * Propogate variable changes
	 * @param {Array<string>} allChangedVariables - variables with changes
	 * @access public
	 */
	onVariablesChanged(allChangedVariables) {
		const style = this.getUnparsedStyle()

		if (style && typeof style.text === 'string') {
			for (const variable of allChangedVariables) {
				if (style.text.includes(`$(${variable})`)) {
					this.logger.silly('variable changed in bank ' + this.controlId)

					this.triggerRedraw()
					return
				}
			}
		}
	}

	/**
	 * Update an option field of this control
	 * @access public
	 */
	optionsSetField(key, value) {
		this.options[key] = value

		this.commitChange()

		return true
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 * @access protected
	 */
	postProcessImport() {
		const ps = []

		ps.push(this.feedbacks.postProcessImport())
		ps.push(this.actions.postProcessImport())

		Promise.all(ps).catch((e) => {
			this.logger.silly(`postProcessImport for ${this.controlId} failed: ${e.message}`)
		})

		this.commitChange()
		this.sendRuntimePropsChange()
	}

	/**
	 * Execute a press of this control
	 * @param {boolean} pressed Whether the control is pressed
	 * @param {string | undefined} deviceId The surface that intiated this press
	 * @access public
	 * @abstract
	 */
	pressControl(pressed, deviceId) {
		throw new Error('must be implemented by subclass!')
	}

	/**
	 * Rename an instance for variables used in this control
	 * @param {string} fromlabel - the old instance short name
	 * @param {string} tolabel - the new instance short name
	 * @access public
	 */
	renameVariables(labelFrom, labelTo) {
		if (this.style?.text) {
			const result = this.instance.variable.renameVariablesInString(this.style.text, labelFrom, labelTo)
			if (this.style.text !== result) {
				this.logger.silly('rewrote ' + this.style.text + ' to ' + result)
				this.style.text = result
			}
		}
	}

	/**
	 * Mark the button as having pending delayed actions
	 * @param {boolean} running Whether any delayed actions are pending
	 * @param {boolean} skip_up Mark the button as released, skipping the release actions
	 * @access public
	 */
	setActionsRunning(running, skip_up) {
		this.has_actions_running = running

		if (skip_up) {
			this.setPushed(false)
		}

		this.triggerRedraw()
	}

	/**
	 * Set the button as being pushed.
	 * Notifies interested observers
	 * @param {boolean} pushed new state
	 * @returns {boolean} the pushed state changed
	 * @access public
	 */
	setPushed(direction, deviceId) {
		const wasPushed = this.pushed
		// Record is as pressed
		this.pushed = !!direction

		if (this.pushed !== wasPushed) {
			// TODO - invalidate feedbacks?

			const parsed = ParseControlId(this.controlId)
			if (parsed?.type === 'bank') {
				this.services.emberplus.updateBankState(parsed.page, parsed.bank, this.pushed, deviceId)
			}

			this.triggerRedraw()

			return true
		} else {
			return false
		}
	}

	/**
	 * Update the style fields of this control
	 * @param {object} diff - config diff to apply
	 * @returns {boolean} true if any changes were made
	 * @access public
	 */
	styleSetFields(diff) {
		if (diff.png64) {
			// Strip the prefix off the base64 png
			if (typeof diff.png64 === 'string' && diff.png64.match(/data:.*?image\/png/)) {
				diff.png64 = diff.png64.replace(/^.*base64,/, '')
			} else {
				// this.logger.info('png64 is not a png url')
				// Delete it
				delete diff.png64
			}
		}

		if (Object.keys(diff).length > 0) {
			// Apply the diff
			Object.assign(this.style, diff)

			if ('show_topbar' in diff) {
				// Some feedbacks will need to redraw
				this.feedbacks.resubscribeAllFeedbacks()
			}

			this.commitChange()

			return true
		} else {
			return false
		}
	}

	/**
	 * Prune all actions/feedbacks referencing unknown instances
	 * Doesn't do any cleanup, as it is assumed that the instance has not been running
	 * @param {Set<string>} knownInstanceIds
	 * @access public
	 */
	verifyInstanceIds(knownInstanceIds) {
		const changedActions = this.actions.verifyInstanceIds(knownInstanceIds)
		const changedFeedbacks = this.feedbacks.verifyInstanceIds(knownInstanceIds)

		if (changedFeedbacks || changedActions) {
			this.commitChange()
		}
	}
}
