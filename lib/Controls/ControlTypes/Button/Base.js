import ControlBase from '../../ControlBase.js'
import { GetButtonBitmapSize } from '../../../Resources/Util.js'
import { cloneDeep } from 'lodash-es'
import FragmentFeedbacks from '../../Fragments/FragmentFeedbacks.js'
import FragmentActions from '../../Fragments/FragmentActions.js'
import {
	ControlWithFeedbacks,
	ControlWithOptions,
	ControlWithPushed,
	ControlWithStyle,
} from '../../IControlFragments.js'

/**
 * @typedef {import('../../../Data/Model/ActionModel.js').ActionInstance} ActionInstance
 * @typedef {import('../../../Data/Model/FeedbackModel.js').FeedbackInstance} FeedbackInstance
 */

/**
 * Abstract class for a editable button control.
 *
 * @extends ControlBase
 * @implements {ControlWithStyle}
 * @implements {ControlWithFeedbacks}
 * @implements {ControlWithOptions}
 * @implements {ControlWithPushed}
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
	 * @readonly
	 * @type {true}
	 */
	supportsStyle = true
	/**
	 * @readonly
	 * @type {true}
	 */
	supportsFeedbacks = true
	/**
	 * @readonly
	 * @type {true}
	 */
	supportsOptions = true
	/**
	 * @readonly
	 * @type {true}
	 */
	supportsPushed = true

	/**
	 * The defaults options for a button
	 * @type {import('../../../Data/Model/ButtonModel.js').ButtonOptionsBase}
	 * @access public
	 * @static
	 */
	static DefaultOptions = {
		relativeDelay: false,
	}

	/**
	 * The feedbacks fragment
	 * @type {FragmentFeedbacks}
	 * @access public
	 * @readonly
	 */
	feedbacks

	/**
	 * The current status of this button
	 * @type {'good' | 'warning' | 'error'}
	 * @access protected
	 */
	bank_status = 'good'

	/**
	 * The config of this button
	 * @type {import('../../../Data/Model/ButtonModel.js').ButtonOptionsBase}
	 */
	options

	/**
	 * Whether this button has delayed actions running
	 * @access protected
	 */
	has_actions_running = false

	/**
	 * Whether this button is currently pressed
	 * @access public
	 */
	pushed = false

	/**
	 * The variabls referenced in the last draw. Whenever one of these changes, a redraw should be performed
	 * @access protected
	 * @type {Set<string> | null}
	 */
	last_draw_variables = null

	/**
	 * Steps on this button
	 * @access public
	 * @type {Record<number, FragmentActions>}
	 */
	steps = {}

	/**
	 * @param {import('../../../Registry.js').default} registry
	 * @param {string} controlId
	 * @param {string} logSource
	 * @param {string} debugNamespace
	 */
	constructor(registry, controlId, logSource, debugNamespace) {
		super(registry, controlId, logSource, debugNamespace)

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
	checkButtonStatus = (redraw = true) => {
		// Find all the instances referenced by the bank
		const instance_ids = new Set()
		for (const step of Object.values(this.steps)) {
			for (const actions of Object.values(step.action_sets)) {
				if (!actions) continue
				for (const action of actions) {
					instance_ids.add(action.instance)
				}
			}
		}

		// Figure out the combined status
		/** @type {'good' | 'warning' | 'error'} */
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
	 * Remove any tracked state for an instance
	 * @param {string} instanceId
	 * @returns {void}
	 * @access public
	 */
	clearInstanceState(instanceId) {
		this.feedbacks.clearInstanceState(instanceId)
	}

	/**
	 * Prepare this control for deletion
	 * @returns {void}
	 * @access public
	 */
	destroy() {
		this.feedbacks.destroy()

		for (const step of Object.values(this.steps)) {
			step.destroy()
		}

		super.destroy()
	}

	/**
	 * Remove any actions and feedbacks referencing a specified instanceId
	 * @param {string} instanceId
	 * @returns {void}
	 * @access public
	 */
	forgetInstance(instanceId) {
		const changedFeedbacks = this.feedbacks.forgetInstance(instanceId)

		let changedSteps = false
		for (const step of Object.values(this.steps)) {
			const changed = step.forgetInstance(instanceId)
			changedSteps = changedSteps || changed
		}

		if (changedFeedbacks || changedSteps) {
			this.commitChange(changedFeedbacks)
		}
	}

	/**
	 * Get all the actions on this control
	 * @returns {ActionInstance[]}
	 */
	getAllActions() {
		const actions = []

		for (const step of Object.values(this.steps)) {
			for (const set of Object.values(step.action_sets)) {
				if (!set) continue
				actions.push(...set)
			}
		}

		return actions
	}

	/**
	 * Get the size of the bitmap render of this control
	 * @access public
	 * @abstract
	 */
	getBitmapSize() {
		return GetButtonBitmapSize(this.registry, this.feedbacks.baseStyle)
	}

	/**
	 * Get the complete style object of a button
	 * @returns {import('../../../Data/Model/StyleModel.js').DrawStyleButtonModel} the processed style of the button
	 * @access public
	 */
	getDrawStyle() {
		let style = this.feedbacks.getUnparsedStyle()

		if (style.text) {
			// Block out the button text
			/** @type {import('@companion-module/base').CompanionVariableValues} */
			const injectedVariableValues = {}
			const location = this.page.getLocationOfControlId(this.controlId)
			if (location) {
				// Ensure we don't enter into an infinite loop
				// TODO - legacy location variables?
				injectedVariableValues[`$(internal:b_text_${location.pageNumber}_${location.row}_${location.column})`] = '$RE'
			}

			if (style.textExpression) {
				try {
					const parseResult = this.instance.variable.parseExpression(style.text, undefined, injectedVariableValues)
					style.text = parseResult.value + ''
					this.last_draw_variables = parseResult.variableIds.size > 0 ? parseResult.variableIds : null
				} catch (e) {
					this.logger.error(`Expression parse error: ${e}`)

					style.text = 'ERR'
					this.last_draw_variables = null
				}
			} else {
				const parseResult = this.instance.variable.parseVariables(style.text, injectedVariableValues)
				style.text = parseResult.text
				this.last_draw_variables = parseResult.variableIds.length > 0 ? new Set(parseResult.variableIds) : null
			}
		}

		return {
			...cloneDeep(style),

			cloud: false,
			step_cycle: undefined,

			pushed: !!this.pushed,
			action_running: this.has_actions_running,
			bank_status: this.bank_status,

			style: 'button',
		}
	}

	/**
	 * Propagate variable changes
	 * @param {Set<string>} allChangedVariables - variables with changes
	 * @access public
	 */
	onVariablesChanged(allChangedVariables) {
		if (this.last_draw_variables) {
			for (const variable of allChangedVariables.values()) {
				if (this.last_draw_variables.has(variable)) {
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
	 * @param {string} key
	 * @param {any} value
	 */
	optionsSetField(key, value) {
		// @ts-ignore
		this.options[key] = value

		this.commitChange()

		return true
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 * @returns {void}
	 * @access protected
	 */
	postProcessImport() {
		const ps = []

		ps.push(this.feedbacks.postProcessImport())

		for (const step of Object.values(this.steps)) {
			ps.push(step.postProcessImport())
		}

		Promise.all(ps).catch((e) => {
			this.logger.silly(`postProcessImport for ${this.controlId} failed: ${e.message}`)
		})

		this.commitChange()
		this.sendRuntimePropsChange()
	}

	/**
	 * Execute a press of this control
	 * @param {boolean} _pressed Whether the control is pressed
	 * @param {string | undefined} _deviceId The surface that intiated this press
	 * @param {boolean=} _force Trigger actions even if already in the state
	 * @returns {void}
	 * @access public
	 * @abstract
	 */
	pressControl(_pressed, _deviceId, _force) {
		throw new Error('must be implemented by subclass!')
	}

	/**
	 * Rename an instance for variables used in this control
	 * @param {string} labelFrom - the old instance short name
	 * @param {string} labelTo - the new instance short name
	 * @access public
	 */
	renameVariables(labelFrom, labelTo) {
		const allFeedbacks = this.feedbacks.feedbacks
		const allActions = []
		for (const step of Object.values(this.steps)) {
			allActions.push(...step.getAllActions())
		}

		// Fix up references
		const changed = this.registry.data.importExport.fixupControlReferences(
			{ instanceLabels: { [labelFrom]: labelTo } },
			this.feedbacks.baseStyle,
			allActions,
			allFeedbacks,
			undefined,
			true
		)

		// redraw if needed and save changes
		this.commitChange(changed)
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
	 * @param {boolean} direction new state
	 * @param {string=} deviceId device which triggered the change
	 * @returns {boolean} the pushed state changed
	 * @access public
	 */
	setPushed(direction, deviceId) {
		const wasPushed = this.pushed
		// Record is as pressed
		this.pushed = !!direction

		if (this.pushed !== wasPushed) {
			// TODO - invalidate feedbacks?

			const location = this.page.getLocationOfControlId(this.controlId)
			if (location) {
				this.services.emberplus.updateBankState(location, this.pushed, deviceId)
			}

			this.triggerRedraw()

			return true
		} else {
			return false
		}
	}

	/**
	 * Update the style fields of this control
	 * @param {Record<string, any>} diff - config diff to apply
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
			Object.assign(this.feedbacks.baseStyle, diff)

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
		const changedFeedbacks = this.feedbacks.verifyInstanceIds(knownInstanceIds)

		let changedSteps = false
		for (const step of Object.values(this.steps)) {
			const changed = step.verifyInstanceIds(knownInstanceIds)
			changedSteps = changedSteps || changed
		}

		if (changedFeedbacks || changedSteps) {
			this.commitChange(changedFeedbacks)
		}
	}
}
