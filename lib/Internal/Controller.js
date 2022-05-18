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
import Instance from './Instance.js'
import Time from './Time.js'
import Bank from './Bank.js'
import CustomVariables from './CustomVariables.js'
import Surface from './Surface.js'
import System from './System.js'
import Triggers from './Triggers.js'
import Variables from './Variables.js'
import { cloneDeep } from 'lodash-es'
import { CreateBankControlId } from '../Resources/Util.js'

export default class InternalController extends CoreBase {
	feedbacks = new Map()

	constructor(registry) {
		super(registry, 'internal', 'Internal/Controller')

		this.fragments = [
			new Instance(registry, this),
			new Time(registry, this),
			new Bank(registry, this),
			new CustomVariables(registry, this),
			new Surface(registry, this),
			new System(registry, this),
			new Triggers(registry, this),
			new Variables(registry, this),
		]

		// Set everything up
		this.regenerateActions()
		this.regenerateFeedbacks()
		this.regenerateVariables()

		// TODO - subscribe all

		// Find all the feedbacks on banks
		const all_bank_feedbacks = this.registry.bank.feedback.getAll()
		for (const page in all_bank_feedbacks) {
			for (const bank in all_bank_feedbacks[page]) {
				for (const feedback of all_bank_feedbacks[page][bank]) {
					if (feedback.instance_id === 'internal') {
						this.feedbackUpdate(feedback, CreateBankControlId(page, bank), page, bank)
					}
				}
			}
		}

		// Find all the feedbacks in triggers
		const scheduler_feedbacks = this.triggers.getAllFeedbacks()
		for (const feedback of scheduler_feedbacks) {
			if (feedback.instance_id == 'internal') {
				this.feedbackUpdate(feedback, feedback.triggerId, undefined, undefined)
			}
		}

		// Defer until everything is constructed // TODO - is this reliableenough?
		setImmediate(() => {
			// Make all variables values
			for (const fragment of this.fragments) {
				if (typeof fragment.updateVariables === 'function') {
					fragment.updateVariables()
				}
			}
		})
	}

	feedbackUpdate(feedback, controlId, page, bank) {
		if (feedback.instance_id !== 'internal') throw new Error(`Feedback is not for internal instance`)

		const cloned = {
			...cloneDeep(feedback),
			controlId,
			info: {
				page,
				bank,
			},
		}
		this.feedbacks.set(feedback.id, cloned)

		this.registry.bank.feedback.updateFeedbackValues('internal', [
			{
				id: feedback.id,
				controlId: controlId,
				value: this.feedbackGetValue(cloned),
			},
		])

		// TODO - unhandled
	}
	feedbackDelete(feedback) {
		if (feedback.instance_id !== 'internal') throw new Error(`Feedback is not for internal instance`)

		this.feedbacks.delete(feedback.id)
	}
	feedbackGetValue(feedback) {
		for (const fragment of this.fragments) {
			if (typeof fragment.executeFeedback === 'function') {
				let value
				try {
					value = fragment.executeFeedback(feedback)
				} catch (e) {
					this.logger.silly(`Feedback check failed: ${JSON.stringify(feedback)} - ${e?.message ?? e} ${e?.stack}`)
				}

				if (value !== undefined) {
					// We are done
					return value
				}
			}
		}

		return undefined
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
					this.logger.silly(
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
					value: this.feedbackGetValue(feedback),
				})
			}
		}

		this.registry.bank.feedback.updateFeedbackValues('internal', newValues)
	}
	checkFeedbacksById(...ids) {
		const newValues = []

		for (const id of ids) {
			const feedback = this.feedbacks.get(id)
			if (feedback) {
				newValues.push({
					id: id,
					controlId: feedback.controlId,
					value: this.feedbackGetValue(feedback),
				})
			}
		}

		this.registry.bank.feedback.updateFeedbackValues('internal', newValues)
	}
	regenerateActions() {
		let actions = {}

		for (const fragment of this.fragments) {
			if (typeof fragment.getActionDefinitions === 'function') {
				actions = {
					...actions,
					...fragment.getActionDefinitions(),
				}
			}
		}

		// TODO - omit callback
		this.registry.bank.action.setActionDefinitions('internal', actions)
	}
	regenerateFeedbacks() {
		let feedbacks = {}

		for (const fragment of this.fragments) {
			if (typeof fragment.getFeedbackDefinitions === 'function') {
				feedbacks = {
					...feedbacks,
					...fragment.getFeedbackDefinitions(),
				}
			}
		}

		// TODO - omit callback
		this.registry.bank.feedback.setDefinitions('internal', feedbacks)
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
	// HACK - Can we avoid having everything make calls into this or its children?
	variablesChanged(changed_variables, removed_variables) {
		for (const fragment of this.fragments) {
			if (typeof fragment.variablesChanged === 'function') {
				fragment.variablesChanged(changed_variables, removed_variables)
			}
		}
	}
}
