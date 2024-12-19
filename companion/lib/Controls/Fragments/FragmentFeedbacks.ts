import { cloneDeep } from 'lodash-es'
import LogController, { Logger } from '../../Log/Controller.js'
import { FragmentFeedbackInstance } from './FragmentFeedbackInstance.js'
import { FragmentFeedbackList } from './FragmentFeedbackList.js'
import type { ButtonStyleProperties, UnparsedButtonStyle } from '@companion-app/shared/Model/StyleModel.js'
import type { InstanceDefinitions } from '../../Instance/Definitions.js'
import type { InternalController } from '../../Internal/Controller.js'
import type { ModuleHost } from '../../Instance/Host.js'
import type { FeedbackInstance, FeedbackOwner } from '@companion-app/shared/Model/FeedbackModel.js'
import { FeedbackStyleBuilder } from './FeedbackStyleBuilder.js'

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
			this.#booleanOnly ? 'boolean' : null
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
	 * Add a feedback to this control
	 * @param feedbackItem the item to add
	 * @param ownerId the ids of parent feedback that this feedback should be added as a child of
	 */
	feedbackAdd(feedbackItem: FeedbackInstance, ownerId: FeedbackOwner | null): boolean {
		let newFeedback: FragmentFeedbackInstance

		if (ownerId) {
			const parent = this.#feedbacks.findById(ownerId.parentFeedbackId)
			if (!parent)
				throw new Error(`Failed to find parent feedback ${ownerId.parentFeedbackId} when adding child feedback`)

			newFeedback = parent.addChild(ownerId.childGroup, feedbackItem)
		} else {
			newFeedback = this.#feedbacks.addFeedback(feedbackItem)
		}

		// Inform relevant module
		newFeedback.subscribe(true)

		this.#commitChange()

		return true
	}

	/**
	 * Move a feedback within the hierarchy
	 * @param moveFeedbackId the id of the feedback to move
	 * @param newOwnerId the target parentId of the feedback
	 * @param newIndex the target index of the feedback
	 */
	feedbackMoveTo(moveFeedbackId: string, newOwnerId: FeedbackOwner | null, newIndex: number): boolean {
		const oldItem = this.#feedbacks.findParentAndIndex(moveFeedbackId)
		if (!oldItem) return false

		if (
			oldItem.parent.ownerId?.parentFeedbackId === newOwnerId?.parentFeedbackId &&
			oldItem.parent.ownerId?.childGroup === newOwnerId?.childGroup
		) {
			oldItem.parent.moveFeedback(oldItem.index, newIndex)
		} else {
			const newParent = newOwnerId ? this.#feedbacks.findById(newOwnerId.parentFeedbackId) : null
			if (newOwnerId && !newParent) return false

			// Ensure the new parent is not a child of the feedback being moved
			if (newOwnerId && oldItem.item.findChildById(newOwnerId.parentFeedbackId)) return false

			// Check if the new parent can hold the feedback being moved
			if (newParent && !newParent.canAcceptChild(newOwnerId!.childGroup, oldItem.item)) return false

			const poppedFeedback = oldItem.parent.popFeedback(oldItem.index)
			if (!poppedFeedback) return false

			if (newParent) {
				newParent.pushChild(poppedFeedback, newOwnerId!.childGroup, newIndex)
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
	 * Get all the feedbacks contained
	 */
	getAllFeedbacks(): FragmentFeedbackInstance[] {
		return this.#feedbacks.getAllFeedbacks()
	}

	/**
	 * Get all the feedback instances
	 * @param onlyConnectionId Optionally, only for a specific connection
	 */
	getFlattenedFeedbackInstances(onlyConnectionId?: string): Omit<FeedbackInstance, 'children' | 'advancedChildren'>[] {
		const instances: FeedbackInstance[] = []

		const extractInstances = (feedbacks: FeedbackInstance[]) => {
			for (const feedback of feedbacks) {
				if (!onlyConnectionId || onlyConnectionId === feedback.instance_id) {
					instances.push({
						...feedback,
						children: undefined,
						advancedChildren: undefined,
					})
				}

				if (feedback.children) extractInstances(feedback.children)
				if (feedback.advancedChildren) extractInstances(feedback.advancedChildren)
			}
		}

		extractInstances(this.#feedbacks.asFeedbackInstances())

		return instances
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
