import CoreBase from '../Core/Base.js'
import ControlButtonNormal from './ControlTypes/Button/Normal.js'
import ControlButtonPageDown from './ControlTypes/PageDown.js'
import ControlButtonPageNumber from './ControlTypes/PageNumber.js'
import ControlButtonPageUp from './ControlTypes/PageUp.js'
import { CreateBankControlId, CreateTriggerControlId, ParseControlId, formatLocation } from '../Shared/ControlId.js'
import { ControlConfigRoom } from './ControlBase.js'
import ActionRunner from './ActionRunner.js'
import ActionRecorder from './ActionRecorder.js'
import ControlTrigger from './ControlTypes/Triggers/Trigger.js'
import { nanoid } from 'nanoid'
import TriggerEvents from './TriggerEvents.js'
import debounceFn from 'debounce-fn'

export const TriggersListRoom = 'triggers:list'
const ActiveLearnRoom = 'learn:active'

/**
 * @typedef {import('../Shared/Model/ButtonModel.js').SomeButtonModel | import('../Shared/Model/TriggerModel.js').TriggerModel} SomeControlModel
 */

/**
 * @typedef {ControlTrigger | ControlButtonNormal | ControlButtonPageDown | ControlButtonPageNumber | ControlButtonPageUp} SomeRealControl
 */

/**
 * The class that manages the controls
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.0.4
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
class ControlsController extends CoreBase {
	/**
	 * Actions runner
	 * @type {ActionRunner}
	 * @access public
	 */
	actions

	/**
	 * Actions recorder
	 * @type {ActionRecorder}
	 * @access public
	 */
	actionRecorder

	/**
	 * The currently configured controls
	 * @type {Map<string, import('./IControlFragments.js').SomeControl>}
	 * @access private
	 */
	#controls = new Map()

	/**
	 * Triggers events
	 * @type {TriggerEvents}
	 * @access public
	 */
	triggers

	/**
	 * Active learn requests. Ids of actions & feedbacks
	 * @type {Set<string>}
	 * @access private
	 */
	#activeLearnRequests = new Set()

	/**
	 * @param {import('../Registry.js').default} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'controls', 'Controls/Controller')

		this.actions = new ActionRunner(registry)
		this.actionRecorder = new ActionRecorder(registry)
		this.triggers = new TriggerEvents()

		// Init all the control classes
		const config = this.db.getKey('controls', {})
		for (const [controlId, controlObj] of Object.entries(config)) {
			if (controlObj && controlObj.type) {
				const inst = this.#createClassForControl(controlId, 'all', controlObj, false)
				if (inst) this.#controls.set(controlId, inst)
			}
		}
	}

	/**
	 * Check the connection-status of every control
	 * @access public
	 */
	checkAllStatus = debounceFn(
		() => {
			for (const control of this.#controls.values()) {
				if (typeof control.checkButtonStatus === 'function') {
					control.checkButtonStatus()
				}
			}
		},
		{
			before: false,
			after: true,
			wait: 100,
			maxWait: 500,
		}
	)

	/**
	 * Remove any tracked state for a connection
	 * @param {string} connectionId
	 * @access public
	 */
	clearConnectionState(connectionId) {
		for (const control of this.#controls.values()) {
			if (control.supportsActions || control.supportsFeedbacks) {
				control.clearConnectionState(connectionId)
			}
		}
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		this.actionRecorder.clientConnect(client)

		this.triggers.emit('client_connect')

		client.onPromise(
			'controls:subscribe',
			/**
			 * @param {string} controlId
			 * @returns {unknown}
			 */
			(controlId) => {
				client.join(ControlConfigRoom(controlId))

				setImmediate(() => {
					// Send the preview image shortly after
					const location = this.page.getLocationOfControlId(controlId)
					if (location) {
						const img = this.graphics.getCachedRenderOrGeneratePlaceholder(location)
						// TODO - rework this to use the shared render cache concept
						client.emit(`controls:preview-${controlId}`, img?.asDataUrl)
					}
				})

				const control = this.getControl(controlId)
				return {
					config: control?.toJSON(false),
					runtime: control?.toRuntimeJSON(),
				}
			}
		)

		client.onPromise(
			'controls:unsubscribe',
			/**
			 * @param {string} controlId
			 * @returns {void}
			 */
			(controlId) => {
				client.leave(ControlConfigRoom(controlId))
			}
		)

		client.onPromise(
			'controls:reset',
			/**
			 * @param {import('../Resources/Util.js').ControlLocation} location
			 * @param {string} type
			 * @returns {void}
			 */
			(location, type) => {
				const controlId = this.page.getControlIdAt(location)

				if (controlId) {
					this.deleteControl(controlId)
				}

				if (type) {
					this.createButtonControl(location, type)
				}
			}
		)
		client.onPromise(
			'controls:copy',
			/**
			 * @param {import('../Resources/Util.js').ControlLocation} fromLocation
			 * @param {import('../Resources/Util.js').ControlLocation} toLocation
			 * @returns {boolean}
			 */
			(fromLocation, toLocation) => {
				// Don't try copying over itself
				if (
					fromLocation.pageNumber === toLocation.pageNumber &&
					fromLocation.column === toLocation.column &&
					fromLocation.row === toLocation.row
				)
					return false

				// Make sure target page number is valid
				if (!this.page.isPageValid(toLocation.pageNumber)) return false

				// Make sure there is something to copy
				const fromControlId = this.page.getControlIdAt(fromLocation)
				if (!fromControlId) return false

				const fromControl = this.getControl(fromControlId)
				if (!fromControl) return false
				/** @type {any} */
				const controlJson = fromControl.toJSON(true)

				// Delete the control at the destination
				const toControlId = this.page.getControlIdAt(toLocation)
				if (toControlId) {
					this.deleteControl(toControlId)
				}

				const newControlId = CreateBankControlId(nanoid())
				const newControl = this.#createClassForControl(newControlId, 'button', controlJson, true)
				if (newControl) {
					this.#controls.set(newControlId, newControl)

					this.page.setControlIdAt(toLocation, newControlId)

					newControl.triggerRedraw()

					return true
				}

				return false
			}
		)
		client.onPromise(
			'controls:move',
			/**
			 * @param {import('../Resources/Util.js').ControlLocation} fromLocation
			 * @param {import('../Resources/Util.js').ControlLocation} toLocation
			 * @returns {boolean}
			 */
			(fromLocation, toLocation) => {
				// Don't try moving over itself
				if (
					fromLocation.pageNumber === toLocation.pageNumber &&
					fromLocation.column === toLocation.column &&
					fromLocation.row === toLocation.row
				)
					return false

				// Make sure target page number is valid
				if (!this.page.isPageValid(toLocation.pageNumber)) return false

				// Make sure there is something to move
				const fromControlId = this.page.getControlIdAt(fromLocation)
				if (!fromControlId) return false

				// Delete the control at the destination
				const toControlId = this.page.getControlIdAt(toLocation)
				if (toControlId) {
					this.deleteControl(toControlId)
				}

				// Perform the move
				this.page.setControlIdAt(fromLocation, null)
				this.page.setControlIdAt(toLocation, fromControlId)

				// Inform the control it was moved
				const control = this.getControl(fromControlId)
				if (control) control.triggerLocationHasChanged()

				// Force a redraw
				this.graphics.invalidateButton(fromLocation)
				this.graphics.invalidateButton(toLocation)

				return false
			}
		)
		client.onPromise(
			'controls:swap',
			/**
			 * @param {import('../Resources/Util.js').ControlLocation} fromLocation
			 * @param {import('../Resources/Util.js').ControlLocation} toLocation
			 * @returns {boolean}
			 */
			(fromLocation, toLocation) => {
				// Don't try moving over itself
				if (
					fromLocation.pageNumber === toLocation.pageNumber &&
					fromLocation.column === toLocation.column &&
					fromLocation.row === toLocation.row
				)
					return false

				// Make sure both page numbers are valid
				if (!this.page.isPageValid(toLocation.pageNumber) || !this.page.isPageValid(fromLocation.pageNumber))
					return false

				// Find the ids to move
				const fromControlId = this.page.getControlIdAt(fromLocation)
				const toControlId = this.page.getControlIdAt(toLocation)

				// Perform the swap
				this.page.setControlIdAt(toLocation, null)
				this.page.setControlIdAt(fromLocation, toControlId)
				this.page.setControlIdAt(toLocation, fromControlId)

				// Inform the controls they were moved
				const controlA = fromControlId && this.getControl(fromControlId)
				if (controlA) controlA.triggerLocationHasChanged()
				const controlB = toControlId && this.getControl(toControlId)
				if (controlB) controlB.triggerLocationHasChanged()

				// Force a redraw
				this.graphics.invalidateButton(fromLocation)
				this.graphics.invalidateButton(toLocation)

				return true
			}
		)

		client.onPromise(
			'controls:set-style-fields',
			/**
			 * @param {string} controlId
			 * @param {Record<string, any>} diff
			 * @returns {boolean}
			 */
			(controlId, diff) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsStyle) {
					return control.styleSetFields(diff)
				} else {
					throw new Error(`Control "${controlId}" does not support config`)
				}
			}
		)

		client.onPromise(
			'controls:set-options-field',
			/**
			 * @param {string} controlId
			 * @param {string} key
			 * @param {any} value
			 * @returns {boolean}
			 */
			(controlId, key, value) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsOptions) {
					return control.optionsSetField(key, value)
				} else {
					throw new Error(`Control "${controlId}" does not support options`)
				}
			}
		)

		client.onPromise(
			'controls:feedback:add',
			/**
			 * @param {string} controlId
			 * @param {string} connectionId
			 * @param {string} feedbackId
			 * @returns {boolean}
			 */
			(controlId, connectionId, feedbackId) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsFeedbacks) {
					const feedbackItem = this.instance.definitions.createFeedbackItem(
						connectionId,
						feedbackId,
						control.feedbacks.isBooleanOnly
					)
					if (feedbackItem) {
						return control.feedbacks.feedbackAdd(feedbackItem)
					} else {
						return false
					}
				} else {
					throw new Error(`Control "${controlId}" does not support feedbacks`)
				}
			}
		)

		client.onPromise(
			'controls:feedback:learn',
			/**
			 * @param {string} controlId
			 * @param {string} id
			 * @returns {Promise<boolean>}
			 */
			async (controlId, id) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsFeedbacks) {
					if (this.#activeLearnRequests.has(id)) throw new Error('Learn is already running')
					try {
						this.#setIsLearning(id, true)

						control.feedbacks
							.feedbackLearn(id)
							.catch((e) => {
								this.logger.error(`Learn failed: ${e}`)
							})
							.then(() => {
								this.#setIsLearning(id, false)
							})

						return true
					} catch (e) {
						this.#setIsLearning(id, false)
						throw e
					}
				} else {
					throw new Error(`Control "${controlId}" does not support feedbacks`)
				}
			}
		)

		client.onPromise(
			'controls:feedback:enabled',
			/**
			 * @param {string} controlId
			 * @param {string} id
			 * @param {boolean} enabled
			 * @returns {boolean}
			 */
			(controlId, id, enabled) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsFeedbacks) {
					return control.feedbacks.feedbackEnabled(id, enabled)
				} else {
					throw new Error(`Control "${controlId}" does not support feedbacks`)
				}
			}
		)

		client.onPromise(
			'controls:feedback:set-headline',
			/**
			 * @param {string} controlId
			 * @param {string} id
			 * @param {string} headline
			 * @returns {boolean}
			 */
			(controlId, id, headline) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsFeedbacks) {
					return control.feedbacks.feedbackHeadline(id, headline)
				} else {
					throw new Error(`Control "${controlId}" does not support feedbacks`)
				}
			}
		)

		client.onPromise(
			'controls:feedback:remove',
			/**
			 * @param {string} controlId
			 * @param {string} id
			 * @returns {boolean}
			 */
			(controlId, id) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsFeedbacks) {
					return control.feedbacks.feedbackRemove(id)
				} else {
					throw new Error(`Control "${controlId}" does not support feedbacks`)
				}
			}
		)

		client.onPromise(
			'controls:feedback:duplicate',
			/**
			 * @param {string} controlId
			 * @param {string} id
			 * @returns {boolean}
			 */
			(controlId, id) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsFeedbacks) {
					return control.feedbacks.feedbackDuplicate(id)
				} else {
					throw new Error(`Control "${controlId}" does not support feedbacks`)
				}
			}
		)

		client.onPromise(
			'controls:feedback:set-option',
			/**
			 * @param {string} controlId
			 * @param {string} id
			 * @param {string} key
			 * @param {any} value
			 * @returns {boolean}
			 */
			(controlId, id, key, value) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsFeedbacks) {
					return control.feedbacks.feedbackSetOptions(id, key, value)
				} else {
					throw new Error(`Control "${controlId}" does not support feedbacks`)
				}
			}
		)

		client.onPromise(
			'controls:feedback:set-inverted',
			/**
			 * @param {string} controlId
			 * @param {string} id
			 * @param {boolean} isInverted
			 * @returns {boolean}
			 */
			(controlId, id, isInverted) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsFeedbacks) {
					return control.feedbacks.feedbackSetInverted(id, isInverted)
				} else {
					throw new Error(`Control "${controlId}" does not support feedbacks`)
				}
			}
		)

		client.onPromise(
			'controls:feedback:reorder',
			/**
			 * @param {string} controlId
			 * @param {number} oldIndex
			 * @param {number} newIndex
			 * @returns {boolean}
			 */
			(controlId, oldIndex, newIndex) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsFeedbacks) {
					return control.feedbacks.feedbackReorder(oldIndex, newIndex)
				} else {
					throw new Error(`Control "${controlId}" does not support feedbacks`)
				}
			}
		)
		client.onPromise(
			'controls:feedback:set-style-selection',
			/**
			 * @param {string} controlId
			 * @param {string} id
			 * @param {string[]} selected
			 * @returns {boolean}
			 */
			(controlId, id, selected) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsFeedbacks) {
					return control.feedbacks.feedbackSetStyleSelection(id, selected)
				} else {
					throw new Error(`Control "${controlId}" does not support feedbacks`)
				}
			}
		)
		client.onPromise(
			'controls:feedback:set-style-value',
			/**
			 * @param {string} controlId
			 * @param {string} id
			 * @param {string} key
			 * @param {any} value
			 * @returns {boolean}
			 */
			(controlId, id, key, value) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsFeedbacks) {
					return control.feedbacks.feedbackSetStyleValue(id, key, value)
				} else {
					throw new Error(`Control "${controlId}" does not support feedbacks`)
				}
			}
		)

		client.onPromise(
			'controls:hot-press',
			/**
			 * @param {import('../Resources/Util.js').ControlLocation} location
			 * @param {boolean} direction
			 * @param {string} surfaceId
			 * @returns {void}
			 */
			(location, direction, surfaceId) => {
				this.logger.silly(`being told from gui to hot press ${formatLocation(location)} ${direction} ${surfaceId}`)
				if (!surfaceId) throw new Error('Missing surfaceId')

				const controlId = this.page.getControlIdAt(location)
				if (!controlId) return

				this.pressControl(controlId, direction, `hot:${surfaceId}`)
			}
		)

		client.onPromise(
			'controls:hot-rotate',
			/**
			 * @param {import('../Resources/Util.js').ControlLocation} location
			 * @param {boolean} direction
			 * @param {string} surfaceId
			 * @returns {void}
			 */
			(location, direction, surfaceId) => {
				this.logger.silly(`being told from gui to hot rotate ${formatLocation(location)} ${direction} ${surfaceId}`)

				const controlId = this.page.getControlIdAt(location)
				if (!controlId) return

				this.rotateControl(controlId, direction, surfaceId ? `hot:${surfaceId}` : undefined)
			}
		)

		client.onPromise(
			'controls:action:add',
			/**
			 * @param {string} controlId
			 * @param {string} stepId
			 * @param {string} setId
			 * @param {string} connectionId
			 * @param {string} actionId
			 * @returns {boolean}
			 */
			(controlId, stepId, setId, connectionId, actionId) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsActions) {
					const actionItem = this.instance.definitions.createActionItem(connectionId, actionId)
					if (actionItem) {
						return control.actionAdd(stepId, setId, actionItem)
					} else {
						return false
					}
				} else {
					throw new Error(`Control "${controlId}" does not support actions`)
				}
			}
		)

		client.onPromise(
			'controls:action:learn',
			/**
			 * @param {string} controlId
			 * @param {string} stepId
			 * @param {string} setId
			 * @param {string} id
			 * @returns {Promise<boolean>}
			 */
			async (controlId, stepId, setId, id) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsActions) {
					if (this.#activeLearnRequests.has(id)) throw new Error('Learn is already running')
					try {
						this.#setIsLearning(id, true)

						control
							.actionLearn(stepId, setId, id)
							.catch((e) => {
								this.logger.error(`Learn failed: ${e}`)
							})
							.then(() => {
								this.#setIsLearning(id, false)
							})

						return true
					} catch (e) {
						this.#setIsLearning(id, false)
						throw e
					}
				} else {
					throw new Error(`Control "${controlId}" does not support actions`)
				}
			}
		)

		client.onPromise(
			'controls:action:enabled',
			/**
			 * @param {string} controlId
			 * @param {string} stepId
			 * @param {string} setId
			 * @param {string} id
			 * @param {boolean} enabled
			 * @returns {boolean}
			 */
			(controlId, stepId, setId, id, enabled) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsActions) {
					return control.actionEnabled(stepId, setId, id, enabled)
				} else {
					throw new Error(`Control "${controlId}" does not support actions`)
				}
			}
		)

		client.onPromise(
			'controls:action:set-headline',
			/**
			 * @param {string} controlId
			 * @param {string} stepId
			 * @param {string} setId
			 * @param {string} id
			 * @param {string} headline
			 * @returns {boolean}
			 */
			(controlId, stepId, setId, id, headline) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsActions) {
					return control.actionHeadline(stepId, setId, id, headline)
				} else {
					throw new Error(`Control "${controlId}" does not support actions`)
				}
			}
		)

		client.onPromise(
			'controls:action:remove',
			/**
			 * @param {string} controlId
			 * @param {string} stepId
			 * @param {string} setId
			 * @param {string} id
			 * @returns {boolean}
			 */
			(controlId, stepId, setId, id) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsActions) {
					return control.actionRemove(stepId, setId, id)
				} else {
					throw new Error(`Control "${controlId}" does not support actions`)
				}
			}
		)

		client.onPromise(
			'controls:action:duplicate',
			/**
			 * @param {string} controlId
			 * @param {string} stepId
			 * @param {string} setId
			 * @param {string} id
			 * @returns {boolean}
			 */
			(controlId, stepId, setId, id) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsActions) {
					return control.actionDuplicate(stepId, setId, id)
				} else {
					throw new Error(`Control "${controlId}" does not support actions`)
				}
			}
		)

		client.onPromise(
			'controls:action:set-delay',
			/**
			 * @param {string} controlId
			 * @param {string} stepId
			 * @param {string} setId
			 * @param {string} id
			 * @param {number} delay
			 * @returns {boolean}
			 */
			(controlId, stepId, setId, id, delay) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsActions) {
					return control.actionSetDelay(stepId, setId, id, delay)
				} else {
					throw new Error(`Control "${controlId}" does not support actions`)
				}
			}
		)

		client.onPromise(
			'controls:action:set-option',
			/**
			 * @param {string} controlId
			 * @param {string} stepId
			 * @param {string} setId
			 * @param {string} id
			 * @param {string} key
			 * @param {any} value
			 * @returns {boolean}
			 */
			(controlId, stepId, setId, id, key, value) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsActions) {
					return control.actionSetOption(stepId, setId, id, key, value)
				} else {
					throw new Error(`Control "${controlId}" does not support actions`)
				}
			}
		)
		client.onPromise(
			'controls:action:reorder',
			/**
			 * @param {string} controlId
			 * @param {string} dragStepId
			 * @param {string} dragSetId
			 * @param {number} dragIndex
			 * @param {string} dropStepId
			 * @param {string} dropSetId
			 * @param {number} dropIndex
			 * @returns {boolean}
			 */
			(controlId, dragStepId, dragSetId, dragIndex, dropStepId, dropSetId, dropIndex) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsActions) {
					return control.actionReorder(dragStepId, dragSetId, dragIndex, dropStepId, dropSetId, dropIndex)
				} else {
					throw new Error(`Control "${controlId}" does not support actions`)
				}
			}
		)
		client.onPromise(
			'controls:action-set:add',
			/**
			 * @param {string} controlId
			 * @param {string} stepId
			 * @returns {boolean}
			 */
			(controlId, stepId) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsActionSets) {
					return control.actionSetAdd(stepId)
				} else {
					throw new Error(`Control "${controlId}" does not support this operation`)
				}
			}
		)
		client.onPromise(
			'controls:action-set:remove',
			/**
			 * @param {string} controlId
			 * @param {string} stepId
			 * @param {string} setId
			 * @returns {boolean}
			 */
			(controlId, stepId, setId) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsActionSets) {
					return control.actionSetRemove(stepId, setId)
				} else {
					throw new Error(`Control "${controlId}" does not support this operation`)
				}
			}
		)

		client.onPromise(
			'controls:action-set:rename',
			/**
			 * @param {string} controlId
			 * @param {string} stepId
			 * @param {string} oldSetId
			 * @param {string} newSetId
			 * @returns {boolean}
			 */
			(controlId, stepId, oldSetId, newSetId) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsActionSets) {
					return control.actionSetRename(stepId, oldSetId, newSetId)
				} else {
					throw new Error(`Control "${controlId}" does not support this operation`)
				}
			}
		)

		client.onPromise(
			'controls:action-set:set-run-while-held',
			/**
			 * @param {string} controlId
			 * @param {string} stepId
			 * @param {string} setId
			 * @param {boolean} runWhileHeld
			 * @returns {boolean}
			 */
			(controlId, stepId, setId, runWhileHeld) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsActionSets) {
					return control.actionSetRunWhileHeld(stepId, setId, runWhileHeld)
				} else {
					throw new Error(`Control "${controlId}" does not support this operation`)
				}
			}
		)

		client.onPromise(
			'controls:step:add',
			/**
			 * @param {string} controlId
			 * @returns {string | false}
			 */
			(controlId) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsSteps) {
					return control.stepAdd()
				} else {
					throw new Error(`Control "${controlId}" does not support steps`)
				}
			}
		)
		client.onPromise(
			'controls:step:remove',
			/**
			 * @param {string} controlId
			 * @param {string} stepId
			 * @returns {boolean}
			 */
			(controlId, stepId) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsSteps) {
					return control.stepRemove(stepId)
				} else {
					throw new Error(`Control "${controlId}" does not support steps`)
				}
			}
		)

		client.onPromise(
			'controls:step:swap',
			/**
			 * @param {string} controlId
			 * @param {string} stepId1
			 * @param {string} stepId2
			 * @returns {boolean}
			 */
			(controlId, stepId1, stepId2) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsSteps) {
					return control.stepSwap(stepId1, stepId2)
				} else {
					throw new Error(`Control "${controlId}" does not support steps`)
				}
			}
		)

		client.onPromise(
			'controls:step:set-current',
			/**
			 * @param {string} controlId
			 * @param {string} stepId
			 * @returns {boolean}
			 */
			(controlId, stepId) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsSteps) {
					return control.stepSelectCurrent(stepId)
				} else {
					throw new Error(`Control "${controlId}" does not support steps`)
				}
			}
		)

		client.onPromise('triggers:subscribe', () => {
			client.join(TriggersListRoom)

			/** @type {Record<string, import('./ControlTypes/Triggers/Trigger.js').ClientTriggerData>} */
			const triggers = {}

			for (const [controlId, control] of this.#controls.entries()) {
				if (control instanceof ControlTrigger) {
					triggers[controlId] = control.toTriggerJSON()
				}
			}

			return triggers
		})
		client.onPromise('triggers:unsubscribe', () => {
			client.leave(TriggersListRoom)
		})
		client.onPromise('triggers:create', () => {
			const controlId = CreateTriggerControlId(nanoid())

			const newControl = new ControlTrigger(this.registry, this.triggers, controlId, null, false)
			this.#controls.set(controlId, newControl)

			// Add trigger to the end of the list
			/** @type {ControlTrigger[]} */
			const allTriggers = []
			for (const control of this.#controls.values()) {
				if (control instanceof ControlTrigger) {
					allTriggers.push(control)
				}
			}
			const maxRank = Math.max(0, ...allTriggers.map((control) => control.options.sortOrder))
			newControl.optionsSetField('sortOrder', maxRank, true)

			// Ensure it is stored to the db
			newControl.commitChange()

			return controlId
		})
		client.onPromise(
			'triggers:delete',
			/**
			 * @param {string} controlId
			 * @returns {boolean}
			 */
			(controlId) => {
				if (!this.#validateTriggerControlId(controlId)) {
					// Control id is not valid!
					return false
				}

				const control = this.getControl(controlId)
				if (control) {
					control.destroy()

					this.#controls.delete(controlId)

					this.db.setKey(['controls', controlId], undefined)

					return true
				}

				return false
			}
		)
		client.onPromise(
			'triggers:clone',
			/**
			 * @param {string} controlId
			 * @returns {string | false}
			 */
			(controlId) => {
				if (!this.#validateTriggerControlId(controlId)) {
					// Control id is not valid!
					return false
				}

				const newControlId = CreateTriggerControlId(nanoid())

				const fromControl = this.getControl(controlId)
				if (fromControl) {
					/** @type {any} */
					const controlJson = fromControl.toJSON(true)

					const newControl = this.#createClassForControl(newControlId, 'trigger', controlJson, true)
					if (newControl) {
						this.#controls.set(newControlId, newControl)

						return newControlId
					}
				}

				return false
			}
		)
		client.onPromise(
			'triggers:test',
			/**
			 * @param {string} controlId
			 * @returns {boolean}
			 */
			(controlId) => {
				if (!this.#validateTriggerControlId(controlId)) {
					// Control id is not valid!
					return false
				}

				const control = this.getControl(controlId)
				if (control && control instanceof ControlTrigger) {
					control.executeActions(Date.now(), true)
				}

				return false
			}
		)
		client.onPromise(
			'triggers:set-order',
			/**
			 * @param {string[]} triggerIds
			 * @returns {boolean}
			 */
			(triggerIds) => {
				if (!Array.isArray(triggerIds)) throw new Error('Expected array of ids')

				triggerIds = triggerIds.filter((id) => this.#validateTriggerControlId(id))

				// This is a bit naive, but should be sufficient if the client behaves

				// Update the order based on the ids provided
				triggerIds.forEach((id, index) => {
					const control = this.getControl(id)
					if (control && control.supportsOptions) control.optionsSetField('sortOrder', index, true)
				})

				// Fill in for any which weren't specified
				const updatedTriggerIds = new Set(triggerIds)
				const triggerControls = this.getAllTriggers()
				triggerControls.sort((a, b) => a.options.sortOrder - b.options.sortOrder)

				let nextIndex = triggerIds.length
				for (const control of triggerControls) {
					if (!updatedTriggerIds.has(control.controlId) && control.supportsOptions) {
						control.optionsSetField('sortOrder', nextIndex++, true)
					}
				}

				return true
			}
		)

		client.onPromise(
			'controls:event:add',
			/**
			 * @param {string} controlId
			 * @param {string} eventType
			 * @returns {boolean}
			 */
			(controlId, eventType) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsEvents) {
					const eventItem = this.instance.definitions.createEventItem(eventType)
					if (eventItem) {
						return control.eventAdd(eventItem)
					} else {
						return false
					}
				} else {
					throw new Error(`Control "${controlId}" does not support events`)
				}
			}
		)

		client.onPromise(
			'controls:event:enabled',
			/**
			 * @param {string} controlId
			 * @param {string} id
			 * @param {boolean} enabled
			 * @returns {boolean}
			 */
			(controlId, id, enabled) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsEvents) {
					return control.eventEnabled(id, enabled)
				} else {
					throw new Error(`Control "${controlId}" does not support events`)
				}
			}
		)

		client.onPromise(
			'controls:event:set-headline',
			/**
			 * @param {string} controlId
			 * @param {string} id
			 * @param {string} headline
			 * @returns {boolean}
			 */
			(controlId, id, headline) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsEvents) {
					return control.eventHeadline(id, headline)
				} else {
					throw new Error(`Control "${controlId}" does not support events`)
				}
			}
		)

		client.onPromise(
			'controls:event:remove',
			/**
			 * @param {string} controlId
			 * @param {string} id
			 * @returns {boolean}
			 */
			(controlId, id) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsEvents) {
					return control.eventRemove(id)
				} else {
					throw new Error(`Control "${controlId}" does not support events`)
				}
			}
		)

		client.onPromise(
			'controls:event:duplicate',
			/**
			 * @param {string} controlId
			 * @param {string} id
			 * @returns {boolean}
			 */
			(controlId, id) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsEvents) {
					return control.eventDuplicate(id)
				} else {
					throw new Error(`Control "${controlId}" does not support events`)
				}
			}
		)

		client.onPromise(
			'controls:event:set-option',
			/**
			 * @param {string} controlId
			 * @param {string} id
			 * @param {string} key
			 * @param {any} value
			 * @returns {boolean}
			 */
			(controlId, id, key, value) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsEvents) {
					return control.eventSetOptions(id, key, value)
				} else {
					throw new Error(`Control "${controlId}" does not support events`)
				}
			}
		)

		client.onPromise(
			'controls:event:reorder',
			/**
			 * @param {string} controlId
			 * @param {number} oldIndex
			 * @param {number} newIndex
			 * @returns {boolean}
			 */
			(controlId, oldIndex, newIndex) => {
				const control = this.getControl(controlId)
				if (!control) return false

				if (control.supportsEvents) {
					return control.eventReorder(oldIndex, newIndex)
				} else {
					throw new Error(`Control "${controlId}" does not support events`)
				}
			}
		)

		client.onPromise('controls:subscribe:learn', async () => {
			client.join(ActiveLearnRoom)

			return Array.from(this.#activeLearnRequests)
		})
		client.onPromise('controls:unsubscribe:learn', async () => {
			client.leave(ActiveLearnRoom)
		})
	}

	/**
	 * Create a new control class instance
	 * @param {string} controlId Id of the control
	 * @param {'button' | 'trigger' | 'all'} category 'button' | 'trigger' | 'all'
	 * @param {SomeControlModel | string} controlObj The existing configuration of the control, or string type if it is a new control. Note: the control must be given a clone of an object
	 * @param {boolean} isImport Whether this is an import, and needs additional processing
	 * @returns {import('./IControlFragments.js').SomeControl | null}
	 * @access private
	 */
	#createClassForControl(controlId, category, controlObj, isImport) {
		const controlType = typeof controlObj === 'object' ? controlObj.type : controlObj
		const controlObj2 = typeof controlObj === 'object' ? controlObj : null
		if (category === 'all' || category === 'button') {
			if (controlObj2?.type === 'button' || (controlType === 'button' && !controlObj2)) {
				return new ControlButtonNormal(this.registry, controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'pagenum' || (controlType === 'pagenum' && !controlObj2)) {
				return new ControlButtonPageNumber(this.registry, controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'pageup' || (controlType === 'pageup' && !controlObj2)) {
				return new ControlButtonPageUp(this.registry, controlId, controlObj2, isImport)
			} else if (controlObj2?.type === 'pagedown' || (controlType === 'pagedown' && !controlObj2)) {
				return new ControlButtonPageDown(this.registry, controlId, controlObj2, isImport)
			}
		}

		if (category === 'all' || category === 'trigger') {
			if (controlObj2?.type === 'trigger' || (controlType === 'trigger' && !controlObj2)) {
				return new ControlTrigger(this.registry, this.triggers, controlId, controlObj2, isImport)
			}
		}

		// Unknown type
		this.logger.warn(`Cannot create control "${controlId}" of unknown type "${controlType}"`)
		return null
	}

	/**
	 * Update all controls to forget a connection
	 * @param {string} connectionId
	 * @returns {void}
	 * @access public
	 */
	forgetConnection(connectionId) {
		for (const control of this.#controls.values()) {
			if (control.supportsActions || control.supportsFeedbacks) {
				control.forgetConnection(connectionId)
			}
		}
	}

	/**
	 * Get all of the populated controls
	 * @returns {ReadonlyMap<string, import('./IControlFragments.js').SomeControl>}
	 * @access public
	 */
	getAllControls() {
		return this.#controls // TODO - readonly?
	}

	/**
	 * Get all of the trigger controls
	 * @returns {ControlTrigger[]}
	 * @access public
	 */
	getAllTriggers() {
		/** @type {ControlTrigger[]} */
		const triggers = []
		for (const control of this.#controls.values()) {
			if (control instanceof ControlTrigger) {
				triggers.push(control)
			}
		}
		return triggers
	}

	/**
	 * Get a control if it has been populated
	 * @param {string} controlId
	 * @returns {import('./IControlFragments.js').SomeControl | undefined}
	 * @access public
	 */
	getControl(controlId) {
		if (!controlId) return undefined
		return this.#controls.get(controlId)
	}

	/**
	 * Get a Trigger control if it exists
	 * @param {string} triggerId
	 * @returns {ControlTrigger | undefined}
	 */
	getTrigger(triggerId) {
		const controlId = CreateTriggerControlId(triggerId)
		const control = this.#controls.get(controlId)
		if (!control || !(control instanceof ControlTrigger)) return undefined
		return control
	}

	/**
	 * Import a control
	 * @param {import('../Resources/Util.js').ControlLocation} location Location to import to
	 * @param {import('../Shared/Model/ButtonModel.js').SomeButtonModel} definition object to import
	 * @param {string=} forceControlId
	 * @returns
	 * @access public
	 */
	importControl(location, definition, forceControlId) {
		if (forceControlId && !this.#validateBankControlId(forceControlId)) {
			// Control id is not valid!
			return false
		}

		// Delete old control at the coordintae
		const oldControlId = this.page.getControlIdAt(location)
		if (oldControlId) {
			this.deleteControl(oldControlId)
		}

		const newControlId = forceControlId || CreateBankControlId(nanoid())
		const newControl = this.#createClassForControl(newControlId, 'button', definition, true)
		if (newControl) {
			this.#controls.set(newControlId, newControl)

			this.page.setControlIdAt(location, newControlId)

			newControl.triggerRedraw()

			// Ensure it is stored to the db
			newControl.commitChange()

			return true
		}

		return false
	}

	/**
	 * Import a trigger
	 * @param {string} controlId Id for the trigger
	 * @param {import('../Shared/Model/TriggerModel.js').TriggerModel} definition object to import
	 * @returns
	 * @access public
	 */
	importTrigger(controlId, definition) {
		if (!this.#validateTriggerControlId(controlId)) {
			// Control id is not valid!
			return false
		}

		if (this.#controls.has(controlId)) throw new Error(`Trigger ${controlId} already exists`)

		const newControl = this.#createClassForControl(controlId, 'trigger', definition, true)
		if (newControl) {
			this.#controls.set(controlId, newControl)

			// Ensure it is stored to the db
			newControl.commitChange()

			return true
		}

		return false
	}

	/**
	 * Propagate variable changes to the controls
	 * @param {Set<string>} allChangedVariablesSet
	 * @access public
	 */
	onVariablesChanged(allChangedVariablesSet) {
		// Inform triggers of the change
		this.triggers.emit('variables_changed', allChangedVariablesSet)

		if (allChangedVariablesSet.size > 0) {
			for (const control of this.#controls.values()) {
				if (control.supportsStyle) {
					control.onVariablesChanged(allChangedVariablesSet)
				}
			}
		}
	}

	/**
	 * Execute a press of a control
	 * @param {string} controlId Id of the control
	 * @param {boolean} pressed Whether the control is pressed
	 * @param {string | undefined} surfaceId The surface that intiated this press
	 * @param {boolean=} force Trigger actions even if already in the state
	 * @returns {boolean} success
	 * @access public
	 */
	pressControl(controlId, pressed, surfaceId, force) {
		const control = this.getControl(controlId)
		if (control) {
			this.triggers.emit('control_press', controlId, pressed, surfaceId)

			control.pressControl(pressed, surfaceId, force)

			return true
		}

		return false
	}

	/**
	 * Execute rotation of a control
	 * @param {string} controlId Id of the control
	 * @param {boolean} direction Whether the control is rotated to the right
	 * @param {string | undefined} surfaceId The surface that intiated this rotate
	 * @returns {boolean} success
	 * @access public
	 */
	rotateControl(controlId, direction, surfaceId) {
		const control = this.getControl(controlId)
		if (control && control.supportsActionSets) {
			control.rotateControl(direction, surfaceId)
			return true
		}

		return false
	}

	/**
	 * Rename a connection for variables used in the controls
	 * @param {string} labelFrom - the old connection short name
	 * @param {string} labelTo - the new connection short name
	 * @returns {void}
	 * @access public
	 */
	renameVariables(labelFrom, labelTo) {
		for (const control of this.#controls.values()) {
			control.renameVariables(labelFrom, labelTo)
		}
	}

	/**
	 * Delete a control
	 * @param {string} controlId
	 * @returns {void}
	 */
	deleteControl(controlId) {
		const control = this.getControl(controlId)
		if (control) {
			control.destroy()
			this.#controls.delete(controlId)

			this.db.setKey(['controls', controlId], undefined)
		}

		const location = this.page.getLocationOfControlId(controlId)
		if (location) {
			this.page.setControlIdAt(location, null)

			// Notify interested parties
			this.services.emberplus.updateButtonState(location, false, undefined)

			// Force a redraw
			this.graphics.invalidateButton(location)
		}
	}

	/**
	 * Create a control
	 * @param {import('../Resources/Util.js').ControlLocation} location Location to place in the grid
	 * @param {string} newType The type of the new control to create (if any)
	 * @returns {string | null} controlId
	 * @access public
	 */
	createButtonControl(location, newType) {
		if (!this.page.isPageValid(location.pageNumber)) return null

		const controlId = CreateBankControlId(nanoid())
		const newControl = this.#createClassForControl(controlId, 'button', newType, false)
		if (!newControl) return null

		this.#controls.set(controlId, newControl)
		this.page.setControlIdAt(location, controlId)

		// Notify interested parties
		this.services.emberplus.updateButtonState(location, false, undefined)

		// Force a redraw
		this.graphics.invalidateButton(location)

		return controlId
	}

	/**
	 * Set an item as learning, or not
	 * @param {string} id
	 * @param {boolean} isActive
	 * @returns {void}
	 */
	#setIsLearning(id, isActive) {
		if (isActive) {
			this.#activeLearnRequests.add(id)
			this.io.emitToRoom(ActiveLearnRoom, 'learn:add', id)
		} else {
			this.#activeLearnRequests.delete(id)
			this.io.emitToRoom(ActiveLearnRoom, 'learn:remove', id)
		}
	}

	/**
	 * Update values for some feedbacks
	 * @param {string} connectionId
	 * @param {NewFeedbackValue[]} result - object containing new values for the feedbacks that have changed
	 * @access public
	 */
	updateFeedbackValues(connectionId, result) {
		if (result.length === 0) return

		/** @type {Record<string, Record<string, any>>} */
		const values = {}

		for (const item of result) {
			if (!values[item.controlId]) values[item.controlId] = {}

			values[item.controlId][item.id] = item.value
		}

		// Pass values to controls
		for (const [controlId, newValues] of Object.entries(values)) {
			const control = this.getControl(controlId)
			if (control && control.supportsFeedbacks) {
				control.feedbacks.updateFeedbackValues(connectionId, newValues)
			}
		}
	}

	/**
	 * Verify a controlId is valid for the current id scheme and grid size
	 * @param {string} controlId
	 * @returns {boolean} control is valid
	 * @access private
	 */
	#validateBankControlId(controlId) {
		const parsed = ParseControlId(controlId)
		if (parsed?.type !== 'bank') return false

		return true
	}

	/**
	 * Verify a controlId is valid for the current id scheme and grid size
	 * @param {string} controlId
	 * @returns {boolean} control is valid
	 * @access private
	 */
	#validateTriggerControlId(controlId) {
		const parsed = ParseControlId(controlId)
		if (parsed?.type !== 'trigger') return false

		return true
	}

	/**
	 * Prune any items on controls which belong to an unknown connectionId
	 * @access public
	 */
	verifyConnectionIds() {
		const knownConnectionIds = new Set(this.instance.getAllInstanceIds())
		knownConnectionIds.add('internal')

		for (const control of this.#controls.values()) {
			control.verifyConnectionIds(knownConnectionIds)
		}
	}
}

export default ControlsController

/**
 * @typedef {{
 *   id: string
 *   controlId: string
 *   value: any
 * }} NewFeedbackValue
 */
