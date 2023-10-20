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
	feedbacks = new Map()

	constructor(registry) {
		super(registry, 'internal', 'Internal/Controller')

		this.fragments = [
			new ActionRecorder(registry, this),
			new Instance(registry, this),
			new Time(registry, this),
			new Controls(registry, this),
			new CustomVariables(registry, this),
			new Page(registry, this),
			new Surface(registry, this),
			new System(registry, this),
			new Triggers(registry, this),
			new Variables(registry, this),
		]

		// Set everything up
		this.#regenerateActions()
		this.#regenerateFeedbacks()
		this.regenerateVariables()
	}

	init() {
		// Find all the feedbacks on banks
		const allControls = this.registry.controls.getAllControls()
		for (const [controlId, control] of allControls.entries()) {
			// Discover feedbacks to process
			if (control.feedbacks && control.feedbacks.feedbacks) {
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
			if (control.actionReplace && typeof control.getAllActions === 'function') {
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
			if (typeof fragment.updateVariables === 'function') {
				fragment.updateVariables()
			}
		}
	}

	/**
	 * Perform an upgrade for an action wh
	 * @param {object} action
	 * @param {string} controlId
	 */
	actionUpgrade(action, controlId) {
		for (const fragment of this.fragments) {
			if (typeof fragment.actionUpgrade === 'function') {
				try {
					const newAction = fragment.actionUpgrade(action, controlId)
					if (newAction !== undefined) {
						newAction.actionId = newAction.action
						// It was handled, so break
						return newAction
					}
				} catch (e) {
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
	 * @param {object} feedback
	 * @param {string} controlId
	 */
	feedbackUpgrade(feedback, controlId) {
		for (const fragment of this.fragments) {
			if (typeof fragment.feedbackUpgrade === 'function') {
				try {
					const newFeedback = fragment.feedbackUpgrade(feedback, controlId)
					if (newFeedback !== undefined) {
						newFeedback.feedbackId = newFeedback.type
						// It was handled, so break
						return newFeedback
					}
				} catch (e) {
					this.logger.silly(
						`Feedback upgrade failed: ${JSON.stringify(feedback)}(${controlId}) - ${e?.message ?? e} ${e?.stack}`
					)
				}
			}
		}

		return undefined
	}

	feedbackUpdate(feedback, controlId) {
		if (feedback.instance_id !== 'internal') throw new Error(`Feedback is not for internal instance`)
		if (feedback.disabled) return

		const location = this.page.getLocationOfControlId(controlId)

		const cloned = {
			...cloneDeep(feedback),
			controlId,
			location,
		}
		this.feedbacks.set(feedback.id, cloned)

		this.registry.controls.updateFeedbackValues('internal', [
			{
				id: feedback.id,
				controlId: controlId,
				value: this.#feedbackGetValue(cloned),
			},
		])
	}
	feedbackDelete(feedback) {
		if (feedback.instance_id !== 'internal') throw new Error(`Feedback is not for internal instance`)

		this.feedbacks.delete(feedback.id)

		for (const fragment of this.fragments) {
			if (typeof fragment.forgetFeedback === 'function') {
				try {
					fragment.forgetFeedback(feedback)
				} catch (e) {
					this.logger.silly(`Feedback forget failed: ${JSON.stringify(feedback)} - ${e?.message ?? e} ${e?.stack}`)
				}
			}
		}
	}
	#feedbackGetValue(feedback) {
		for (const fragment of this.fragments) {
			if (typeof fragment.executeFeedback === 'function') {
				let value
				try {
					value = fragment.executeFeedback(feedback)
				} catch (e) {
					this.logger.silly(`Feedback check failed: ${JSON.stringify(feedback)} - ${e?.message ?? e} ${e?.stack}`)
				}

				if (value && typeof value === 'object' && ('referencedVariables' in value || 'value' in value)) {
					feedback.referencedVariables = value.referencedVariables

					// We are done
					return value.value
				} else if (value !== undefined) {
					feedback.referencedVariables = null

					// We are done
					return value
				}
			}
		}

		return undefined
	}

	/**
	 * Visit any references in some internal actions and feedbacks
	 */
	visitReferences(visitor, actions, feedbacks) {
		const internalActions = actions.filter((a) => a.instance === 'internal')
		const internalFeedbacks = feedbacks.filter((a) => a.instance_id === 'internal')

		for (const fragment of this.fragments) {
			if (typeof fragment.visitReferences === 'function') {
				fragment.visitReferences(visitor, internalActions, internalFeedbacks)
			}
		}
	}

	executeAction(action, extras) {
		for (const fragment of this.fragments) {
			if (typeof fragment.executeAction === 'function') {
				try {
					if (fragment.executeAction(action, extras) !== undefined) {
						// It was handled, so break
						return
					}
				} catch (e) {
					this.logger.warn(
						`Action execute failed: ${JSON.stringify(action)}(${JSON.stringify(extras)}) - ${e?.message ?? e} ${
							e?.stack
						}`
					)
				}
			}
		}

		return false
	}

	setVariables(variables) {
		this.registry.instance.variable.setVariableValues('internal', variables)
	}
	checkFeedbacks(...types) {
		const typesSet = new Set(types)

		const newValues = []

		for (const [id, feedback] of this.feedbacks.entries()) {
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
	checkFeedbacksById(...ids) {
		const newValues = []

		for (const id of ids) {
			const feedback = this.feedbacks.get(id)
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
		let actions = {}

		for (const fragment of this.fragments) {
			if (typeof fragment.getActionDefinitions === 'function') {
				actions = {
					...actions,
					...fragment.getActionDefinitions(),
				}
			}
		}

		this.registry.instance.definitions.setActionDefinitions('internal', actions)
	}
	#regenerateFeedbacks() {
		let feedbacks = {}

		for (const fragment of this.fragments) {
			if (typeof fragment.getFeedbackDefinitions === 'function') {
				feedbacks = {
					...feedbacks,
					...fragment.getFeedbackDefinitions(),
				}
			}
		}

		this.registry.instance.definitions.setFeedbackDefinitions('internal', feedbacks)
	}
	regenerateVariables() {
		const variables = []

		for (const fragment of this.fragments) {
			if (typeof fragment.getVariableDefinitions === 'function') {
				variables.push(...fragment.getVariableDefinitions())
			}
		}

		this.registry.instance.variable.setVariableDefinitions('internal', variables)
	}

	// HACK - Can we avoid having everything make calls into this or its children?
	calculateInstanceErrors(instance_statuses) {
		for (const fragment of this.fragments) {
			if (typeof fragment.calculateInstanceErrors === 'function') {
				fragment.calculateInstanceErrors(instance_statuses)
			}
		}
	}

	variablesChanged(all_changed_variables_set) {
		// Inform all fragments
		for (const fragment of this.fragments) {
			if (typeof fragment.variablesChanged === 'function') {
				fragment.variablesChanged(all_changed_variables_set)
			}
		}

		const newValues = []

		// Lookup feedbacks
		for (const [id, feedback] of this.feedbacks.entries()) {
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
