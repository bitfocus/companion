import { cloneDeep } from 'lodash-es'
import LogController, { Logger } from '../../Log/Controller.js'
import { FragmentFeedbackInstance } from './FragmentFeedbackInstance.js'
import { FragmentFeedbackList } from './FragmentFeedbackList.js'
import type { ButtonStyleProperties, UnparsedButtonStyle } from '@companion-app/shared/Model/StyleModel.js'
import type { InstanceDefinitions } from '../../Instance/Definitions.js'
import type { InternalController } from '../../Internal/Controller.js'
import type { ModuleHost } from '../../Instance/Host.js'
import { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'

/**
 * Helper for ControlTypes with feedbacks
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
export class FragmentFeedbacks {
	/**
	 * The defaults style for a button
	 */
	static DefaultStyle: ButtonStyleProperties = {
		text: '',
		textExpression: false,
		size: 'auto',
		png64: null,
		alignment: 'center:center',
		pngalignment: 'center:center',
		color: 0xffffff,
		bgcolor: 0x000000,
		show_topbar: 'default',
	}

	/**
	 * The base style without feedbacks applied
	 */
	baseStyle: ButtonStyleProperties = cloneDeep(FragmentFeedbacks.DefaultStyle)

	/**
	 * Whether this set of feedbacks can only use boolean feedbacks
	 */
	readonly #booleanOnly: boolean

	readonly #controlId: string

	/**
	 * The feedbacks on this control
	 */
	readonly #feedbacks: FragmentFeedbackList

	/**
	 * Whether this set of feedbacks can only use boolean feedbacks
	 */
	get isBooleanOnly(): boolean {
		return this.#booleanOnly
	}

	/**
	 * Commit changes to the database and disk
	 */
	readonly #commitChange: (redraw?: boolean) => void

	/**
	 * Trigger a redraw/invalidation of the control
	 */
	readonly #triggerRedraw: () => void

	/**
	 * The logger
	 */
	readonly #logger: Logger

	constructor(
		instanceDefinitions: InstanceDefinitions,
		internalModule: InternalController,
		moduleHost: ModuleHost,
		controlId: string,
		commitChange: (redraw?: boolean) => void,
		triggerRedraw: () => void,
		booleanOnly: boolean
	) {
		this.#logger = LogController.createLogger(`Controls/Fragments/Feedbacks/${controlId}`)

		this.#controlId = controlId
		this.#commitChange = commitChange
		this.#triggerRedraw = triggerRedraw
		this.#booleanOnly = booleanOnly

		this.#feedbacks = new FragmentFeedbackList(
			instanceDefinitions,
			internalModule,
			moduleHost,
			this.#controlId,
			null,
			this.#booleanOnly
		)
	}

	/**
	 * Initialise from storage
	 * @param feedbacks
	 * @param skipSubscribe Whether to skip calling subscribe for the new feedbacks
	 * @param isCloned Whether this is a cloned instance
	 */
	loadStorage(feedbacks: FeedbackInstance[], skipSubscribe?: boolean, isCloned?: boolean) {
		this.#feedbacks.loadStorage(feedbacks, !!skipSubscribe, !!isCloned)
	}

	/**
	 * Get the value from all feedbacks as a single boolean
	 */
	checkValueAsBoolean(): boolean {
		return this.#feedbacks.getBooleanValue()
	}

	/**
	 * Remove any tracked state for a connection
	 */
	clearConnectionState(connectionId: string): void {
		const changed = this.#feedbacks.clearCachedValueForConnectionId(connectionId)
		if (changed) this.#triggerRedraw()
	}

	/**
	 * Prepare this control for deletion
	 * @access public
	 */
	destroy(): void {
		this.loadStorage([])
	}

	/**
	 * Add a feedback to this control
	 * @param feedbackItem the item to add
	 * @param parentId the ids of parent feedback that this feedback should be added as a child of
	 */
	feedbackAdd(feedbackItem: FeedbackInstance, parentId: string | null): boolean {
		let newFeedback: FragmentFeedbackInstance

		if (parentId) {
			const parent = this.#feedbacks.findById(parentId)
			if (!parent) throw new Error(`Failed to find parent feedback ${parentId} when adding child feedback`)

			newFeedback = parent.addChild(feedbackItem)
		} else {
			newFeedback = this.#feedbacks.addFeedback(feedbackItem)
		}

		// Inform relevant module
		newFeedback.subscribe(true)

		this.#commitChange()

		return true
	}

	/**
	 * Duplicate an feedback on this control
	 */
	feedbackDuplicate(id: string): boolean {
		const feedback = this.#feedbacks.duplicateFeedback(id)
		if (feedback) {
			this.#commitChange(false)

			return true
		}

		return false
	}

	/**
	 * Enable or disable a feedback
	 */
	feedbackEnabled(id: string, enabled: boolean): boolean {
		const feedback = this.#feedbacks.findById(id)
		if (feedback) {
			feedback.setEnabled(enabled)

			this.#commitChange()

			return true
		}

		return false
	}

	/**
	 * Set headline for the feedback
	 */
	feedbackHeadline(id: string, headline: string): boolean {
		const feedback = this.#feedbacks.findById(id)
		if (feedback) {
			feedback.setHeadline(headline)

			this.#commitChange()

			return true
		}

		return false
	}

	/**
	 * Learn the options for a feedback, by asking the instance for the current values
	 */
	async feedbackLearn(id: string): Promise<boolean> {
		const feedback = this.#feedbacks.findById(id)
		if (!feedback) return false

		const changed = await feedback.learnOptions()
		if (!changed) return false

		// Time has passed due to the `await`
		// So the feedback may not still exist, meaning we should find it again to be sure
		const feedbackAfter = this.#feedbacks.findById(id)
		if (!feedbackAfter) return false

		this.#commitChange(true)
		return true
	}

	/**
	 * Remove a feedback from this control
	 */
	feedbackRemove(id: string): boolean {
		if (this.#feedbacks.removeFeedback(id)) {
			this.#commitChange()

			return true
		} else {
			return false
		}
	}

	/**
	 * Move a feedback within the hierarchy
	 * @param moveFeedbackId the id of the feedback to move
	 * @param newParentId the target parentId of the feedback
	 * @param newIndex the target index of the feedback
	 */
	feedbackMoveTo(moveFeedbackId: string, newParentId: string | null, newIndex: number): boolean {
		const oldItem = this.#feedbacks.findParentAndIndex(moveFeedbackId)
		if (!oldItem) return false

		if (oldItem.parent.id === newParentId) {
			oldItem.parent.moveFeedback(oldItem.index, newIndex)
		} else {
			const newParent = newParentId ? this.#feedbacks.findById(newParentId) : null
			if (newParentId && !newParent) return false

			// Ensure the new parent is not a child of the feedback being moved
			if (newParentId && oldItem.item.findChildById(newParentId)) return false

			// Check if the new parent can hold the feedback being moved
			if (newParent && !newParent.canAcceptChild(oldItem.item)) return false

			const poppedFeedback = oldItem.parent.popFeedback(oldItem.index)
			if (!poppedFeedback) return false

			if (newParent) {
				newParent.pushChild(poppedFeedback, newIndex)
			} else {
				this.#feedbacks.pushFeedback(poppedFeedback, newIndex)
			}
		}

		this.#commitChange()

		return true
	}

	/**
	 * Replace a feedback with an updated version
	 */
	feedbackReplace(
		newProps: Pick<FeedbackInstance, 'id' | 'type' | 'style' | 'options' | 'isInverted'>,
		skipNotifyModule = false
	): boolean {
		const feedback = this.#feedbacks.findById(newProps.id)
		if (feedback) {
			feedback.replaceProps(newProps, skipNotifyModule)

			this.#commitChange(true)

			return true
		}

		return false
	}

	/**
	 * Update an option for a feedback
	 * @param id the id of the feedback
	 * @param key the key/name of the property
	 * @param value the new value
	 */
	feedbackSetOptions(id: string, key: string, value: any): boolean {
		const feedback = this.#feedbacks.findById(id)
		if (feedback) {
			feedback.setOption(key, value)

			this.#commitChange()

			return true
		}

		return false
	}

	/**
	 * Set a new connection instance for a feedback
	 * @param id the id of the feedback
	 * @param connectionId the id of the new connection
	 */
	feedbackSetConnection(id: string, connectionId: string | number): boolean {
		const feedback = this.#feedbacks.findById(id)
		if (feedback) {
			feedback.setInstance(connectionId)

			this.#commitChange()

			return true
		}

		return false
	}

	/**
	 * Set whether a boolean feedback should be inverted
	 * @param id the id of the feedback
	 * @param isInverted the new value
	 */
	feedbackSetInverted(id: string, isInverted: boolean): boolean {
		const feedback = this.#feedbacks.findById(id)
		if (feedback) {
			feedback.setInverted(!!isInverted)

			this.#commitChange()

			return true
		}

		return false
	}

	/**
	 * Update the selected style properties for a boolean feedback
	 * @param id the id of the feedback
	 * @param selected the properties to be selected
	 */
	feedbackSetStyleSelection(id: string, selected: string[]): boolean {
		if (this.#booleanOnly) throw new Error('FragmentFeedbacks not setup to use styles')

		const feedback = this.#feedbacks.findById(id)
		if (feedback && feedback.setStyleSelection(selected, this.baseStyle)) {
			this.#commitChange()

			return true
		}

		return false
	}

	/**
	 * Update an style property for a boolean feedback
	 * @param id the id of the feedback
	 * @param key the key/name of the property
	 * @param value the new value
	 */
	feedbackSetStyleValue(id: string, key: string, value: any): boolean {
		if (this.#booleanOnly) throw new Error('FragmentFeedbacks not setup to use styles')

		const feedback = this.#feedbacks.findById(id)
		if (feedback && feedback.setStyleValue(key, value)) {
			this.#commitChange()

			return true
		}

		return false
	}

	/**
	 * Remove any actions referencing a specified connectionId
	 */
	forgetConnection(connectionId: string): boolean {
		// Cleanup any feedbacks
		return this.#feedbacks.forgetForConnection(connectionId)
	}

	/**
	 * Get all the feedback instances
	 */
	getAllFeedbackInstances(): FeedbackInstance[] {
		return this.#feedbacks.asFeedbackInstances()
	}

	/**
	 * Get all the feedbacks contained
	 */
	getAllFeedbacks(): FragmentFeedbackInstance[] {
		return this.#feedbacks.getAllFeedbacks()
	}

	/**
	 * Get all the feedback instances
	 * @param onlyConnectionId Optionally, only for a specific connection
	 */
	getFlattenedFeedbackInstances(onlyConnectionId?: string): Omit<FeedbackInstance, 'children'>[] {
		const instances: FeedbackInstance[] = []

		const extractInstances = (feedbacks: FeedbackInstance[]) => {
			for (const feedback of feedbacks) {
				if (!onlyConnectionId || onlyConnectionId === feedback.instance_id) {
					instances.push({
						...feedback,
						children: undefined,
					})
				}

				if (feedback.children) {
					extractInstances(feedback.children)
				}
			}
		}

		extractInstances(this.#feedbacks.asFeedbackInstances())

		return instances
	}

	/**
	 * Get the unparsed style for these feedbacks
	 * Note: Does not clone the style
	 */
	getUnparsedStyle(): UnparsedButtonStyle {
		return this.#feedbacks.getUnparsedStyle(this.baseStyle)
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 */
	async postProcessImport(): Promise<void> {
		await Promise.all(this.#feedbacks.postProcessImport()).catch((e) => {
			this.#logger.silly(`postProcessImport for ${this.#controlId} failed: ${e.message}`)
		})
	}

	/**
	 * Re-trigger 'subscribe' for all feedbacks
	 * This should be used when something has changed which will require all feedbacks to be re-run
	 * @param onlyConnectionId If set, only re-subscribe feedbacks for this connection
	 */
	resubscribeAllFeedbacks(onlyConnectionId?: string): void {
		this.#feedbacks.subscribe(true, onlyConnectionId)
	}

	/**
	 * Update the feedbacks on the button with new values
	 * @param connectionId The instance the feedbacks are for
	 * @param newValues The new feedback values
	 */
	updateFeedbackValues(connectionId: string, newValues: Record<string, any>): void {
		let changed = false

		for (const id in newValues) {
			const feedback = this.#feedbacks.findById(id)
			if (feedback && feedback.connectionId === connectionId && feedback.setCachedValue(newValues[id])) {
				changed = true
			}
		}

		if (changed) {
			this.#triggerRedraw()
		}
	}

	/**
	 * Prune all actions/feedbacks referencing unknown conncetions
	 * Doesn't do any cleanup, as it is assumed that the connection has not been running
	 */
	verifyConnectionIds(knownConnectionIds: Set<string>): boolean {
		return this.#feedbacks.verifyConnectionIds(knownConnectionIds)
	}
}
