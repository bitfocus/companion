/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

import CoreBase from '../Core/Base.js'
import ActionRecorder from './ActionRecorder.js'
import Instance from './Instance.js'
import Time from './Time.js'
import Controls from './Controls.js'
import CustomVariables from './CustomVariables.js'
import Surface from './Surface.js'
import System from './System.js'
import Triggers from './Triggers.js'
import Variables from './Variables.js'
import { cloneDeep } from 'lodash-es'
import Page from './Page.js'

export default class InternalController extends CoreBase {
	/**
	 * @type {Map<string, import('./Types.js').FeedbackInstanceExt>}
	 * @readonly
	 */
	#feedbacks = new Map()

	/**
	 * @param {import('../Registry.js').default} registry
	 */
	constructor(registry) {
		super(registry, 'internal', 'Internal/Controller')

		this.fragments = [
			new ActionRecorder(this, registry.controls.actionRecorder, registry.page, registry.instance.variable),
			new Instance(this, registry.instance),
			new Time(this),
			new Controls(this, registry.graphics, registry.controls, registry.page, registry.instance.variable),
			new CustomVariables(this, registry.instance.variable),
			new Page(this, registry.page),
			new Surface(this, registry.surfaces, registry.controls, registry.instance.variable),
			new System(this, registry),
			new Triggers(this, registry.controls),
			new Variables(this, registry.instance.variable),
		]

		// Set everything up
		this.#regenerateActions()
		this.#regenerateFeedbacks()
		this.regenerateVariables()
	}

	init() {
		// Find all the feedbacks on controls
		const allControls = this.registry.controls.getAllControls()
		for (const [controlId, control] of allControls.entries()) {
			// Discover feedbacks to process
			if (control.supportsFeedbacks && control.feedbacks.feedbacks) {
				for (let feedback of control.feedbacks.feedbacks) {
					if (feedback.instance_id === 'internal') {
						if (control.feedbacks.feedbackReplace) {
							const newFeedback = this.feedbackUpgrade(feedback, controlId)
							if (newFeedback) {
								feedback = newFeedback
								control.feedbacks.feedbackReplace(newFeedback)
							}
						}

						this.feedbackUpdate(feedback, controlId)
					}
				}
			}

			// Discover actions to process
			if (control.supportsActions) {
				const actions = control.getAllActions()

				for (const action of actions) {
					if (action.instance === 'internal') {
						// Try and run an upgrade
						const newAction = this.actionUpgrade(action, controlId)
						if (newAction) {
							control.actionReplace(newAction)
						}
					}
				}
			}
		}

		// Make all variables values
		for (const fragment of this.fragments) {
			if ('updateVariables' in fragment && typeof fragment.updateVariables === 'function') {
				fragment.updateVariables()
			}
		}
	}

	/**
	 * Perform an upgrade for an action
	 * @param {import('../Shared/Model/ActionModel.js').ActionInstance} action
	 * @param {string} controlId
	 * @returns {import('../Shared/Model/ActionModel.js').ActionInstance | undefined} Updated action if any changes were made
	 */
	actionUpgrade(action, controlId) {
		for (const fragment of this.fragments) {
			if ('actionUpgrade' in fragment && typeof fragment.actionUpgrade === 'function') {
				try {
					const newAction = fragment.actionUpgrade(action, controlId)
					if (newAction !== undefined) {
						// newAction.actionId = newAction.action
						// It was handled, so break
						return newAction
					}
				} catch (/** @type {any} */ e) {
					this.logger.silly(
						`Action upgrade failed: ${JSON.stringify(action)}(${controlId}) - ${e?.message ?? e} ${e?.stack}`
					)
				}
			}
		}

		return undefined
	}
	/**
	 * Perform an upgrade for a feedback
	 * @param {import('../Shared/Model/FeedbackModel.js').FeedbackInstance} feedback
	 * @param {string} controlId
	 * @returns {import('../Shared/Model/FeedbackModel.js').FeedbackInstance | undefined} Updated feedback if any changes were made
	 */
	feedbackUpgrade(feedback, controlId) {
		for (const fragment of this.fragments) {
			if ('feedbackUpgrade' in fragment && typeof fragment.feedbackUpgrade === 'function') {
				try {
					const newFeedback = fragment.feedbackUpgrade(feedback, controlId)
					if (newFeedback !== undefined) {
						// newFeedback.feedbackId = newFeedback.type
						// It was handled, so break
						return newFeedback
					}
				} catch (/** @type {any} */ e) {
					this.logger.silly(
						`Feedback upgrade failed: ${JSON.stringify(feedback)}(${controlId}) - ${e?.message ?? e} ${e?.stack}`
					)
				}
			}
		}

		return undefined
	}

	/**
	 * A feedback has changed, and state should be updated
	 * @param {import('../Shared/Model/FeedbackModel.js').FeedbackInstance} feedback
	 * @param {string} controlId
	 * @returns {void}
	 */
	feedbackUpdate(feedback, controlId) {
		if (feedback.instance_id !== 'internal') throw new Error(`Feedback is not for internal instance`)
		if (feedback.disabled) return

		const location = this.page.getLocationOfControlId(controlId)

		/** @type {import('./Types.js').FeedbackInstanceExt} */
		const cloned = {
			...cloneDeep(feedback),
			controlId,
			location,
			referencedVariables: null,
		}
		this.#feedbacks.set(feedback.id, cloned)

		this.registry.controls.updateFeedbackValues('internal', [
			{
				id: feedback.id,
				controlId: controlId,
				value: this.#feedbackGetValue(cloned),
			},
		])
	}
	/**
	 * A feedback has been deleted
	 * @param {import('../Shared/Model/FeedbackModel.js').FeedbackInstance} feedback
	 * @returns {void}
	 */
	feedbackDelete(feedback) {
		if (feedback.instance_id !== 'internal') throw new Error(`Feedback is not for internal instance`)

		this.#feedbacks.delete(feedback.id)

		for (const fragment of this.fragments) {
			if ('forgetFeedback' in fragment && typeof fragment.forgetFeedback === 'function') {
				try {
					fragment.forgetFeedback(feedback)
				} catch (/** @type {any} */ e) {
					this.logger.silly(`Feedback forget failed: ${JSON.stringify(feedback)} - ${e?.message ?? e} ${e?.stack}`)
				}
			}
		}
	}
	/**
	 * Get an updated value for a feedback
	 * @param {import('./Types.js').FeedbackInstanceExt} feedback
	 * @returns {any}
	 */
	#feedbackGetValue(feedback) {
		for (const fragment of this.fragments) {
			if ('executeFeedback' in fragment && typeof fragment.executeFeedback === 'function') {
				/** @type {undefined | void | boolean |import('@companion-module/base').CompanionFeedbackButtonStyleResult | { value: any, referencedVariables: string[] }} */
				let value
				try {
					value = fragment.executeFeedback(feedback)
				} catch (/** @type {any} */ e) {
					this.logger.silly(`Feedback check failed: ${JSON.stringify(feedback)} - ${e?.message ?? e} ${e?.stack}`)
				}

				if (value && typeof value === 'object' && 'referencedVariables' in value) {
					feedback.referencedVariables = value.referencedVariables

					return value.value
				} else if (value !== undefined) {
					feedback.referencedVariables = null

					return value
				}
			}
		}

		return undefined
	}

	/**
	 * Visit any references in some inactive internal actions and feedbacks
	 * @param {import('./Types.js').InternalVisitor} visitor
	 * @param {import('../Shared/Model/ActionModel.js').ActionInstance[]} actions
	 * @param {import('../Shared/Model/FeedbackModel.js').FeedbackInstance[]} feedbacks
	 */
	visitReferences(visitor, actions, feedbacks) {
		const internalActions = actions.filter((a) => a.instance === 'internal')
		const internalFeedbacks = feedbacks.filter((a) => a.instance_id === 'internal')

		for (const fragment of this.fragments) {
			if ('visitReferences' in fragment && typeof fragment.visitReferences === 'function') {
				fragment.visitReferences(visitor, internalActions, internalFeedbacks)
			}
		}
	}

	/**
	 * Run a single internal action
	 * @param {import('../Shared/Model/ActionModel.js').ActionInstance} action
	 * @param {import('../Instance/Wrapper.js').RunActionExtras} extras
	 * @returns {void}
	 */
	executeAction(action, extras) {
		for (const fragment of this.fragments) {
			if ('executeAction' in fragment && typeof fragment.executeAction === 'function') {
				try {
					if (fragment.executeAction(action, extras)) {
						// It was handled, so break
						return
					}
				} catch (/** @type {any} */ e) {
					this.logger.warn(
						`Action execute failed: ${JSON.stringify(action)}(${JSON.stringify(extras)}) - ${e?.message ?? e} ${
							e?.stack
						}`
					)
				}
			}
		}
	}

	/**
	 * Set internal variable values
	 * @param {Record<string, import('@companion-module/base').CompanionVariableValue | undefined>} variables
	 * @returns {void}
	 */
	setVariables(variables) {
		this.registry.instance.variable.setVariableValues('internal', variables)
	}
	/**
	 * Recheck all feedbacks of specified types
	 * @param  {...string} types
	 * @returns {void}
	 */
	checkFeedbacks(...types) {
		const typesSet = new Set(types)

		/** @type {import('../Controls/Controller.js').NewFeedbackValue[]} */
		const newValues = []

		for (const [id, feedback] of this.#feedbacks.entries()) {
			if (typesSet.size === 0 || typesSet.has(feedback.type)) {
				newValues.push({
					id: id,
					controlId: feedback.controlId,
					value: this.#feedbackGetValue(feedback),
				})
			}
		}

		this.registry.controls.updateFeedbackValues('internal', newValues)
	}
	/**
	 * Recheck all feedbacks of specified id
	 * @param  {...string} ids
	 * @returns {void}
	 */
	checkFeedbacksById(...ids) {
		/** @type {import('../Controls/Controller.js').NewFeedbackValue[]} */
		const newValues = []

		for (const id of ids) {
			const feedback = this.#feedbacks.get(id)
			if (feedback) {
				newValues.push({
					id: id,
					controlId: feedback.controlId,
					value: this.#feedbackGetValue(feedback),
				})
			}
		}

		this.registry.controls.updateFeedbackValues('internal', newValues)
	}
	#regenerateActions() {
		/** @type {Record<string, import('../Instance/Definitions.js').ActionDefinition>} */
		let actions = {}

		for (const fragment of this.fragments) {
			if ('getActionDefinitions' in fragment && typeof fragment.getActionDefinitions === 'function') {
				for (const [id, action] of Object.entries(fragment.getActionDefinitions())) {
					actions[id] = {
						...action,
						hasLearn: action.hasLearn ?? false,
						// @ts-ignore
						learnTimeout: action.learnTimeout,
					}
				}
			}
		}

		this.registry.instance.definitions.setActionDefinitions('internal', actions)
	}
	#regenerateFeedbacks() {
		/** @type {Record<string, import('../Instance/Definitions.js').FeedbackDefinition>} */
		let feedbacks = {}

		for (const fragment of this.fragments) {
			if ('getFeedbackDefinitions' in fragment && typeof fragment.getFeedbackDefinitions === 'function') {
				for (const [id, feedback] of Object.entries(fragment.getFeedbackDefinitions())) {
					feedbacks[id] = feedback
				}
			}
		}

		this.registry.instance.definitions.setFeedbackDefinitions('internal', feedbacks)
	}
	regenerateVariables() {
		const variables = []

		for (const fragment of this.fragments) {
			if ('getVariableDefinitions' in fragment && typeof fragment.getVariableDefinitions === 'function') {
				variables.push(...fragment.getVariableDefinitions())
			}
		}

		this.registry.instance.variable.setVariableDefinitions('internal', variables)
	}

	/**
	 * @param {Set<string>} all_changed_variables_set
	 */
	variablesChanged(all_changed_variables_set) {
		// Inform all fragments
		for (const fragment of this.fragments) {
			if ('variablesChanged' in fragment && typeof fragment.variablesChanged === 'function') {
				fragment.variablesChanged(all_changed_variables_set)
			}
		}

		const newValues = []

		// Lookup feedbacks
		for (const [id, feedback] of this.#feedbacks.entries()) {
			if (!feedback.referencedVariables || !feedback.referencedVariables.length) continue

			// Check a referenced variable was changed
			if (!feedback.referencedVariables.some((variable) => all_changed_variables_set.has(variable))) continue

			newValues.push({
				id: id,
				controlId: feedback.controlId,
				value: this.#feedbackGetValue(feedback),
			})
		}

		this.registry.controls.updateFeedbackValues('internal', newValues)
	}
}
