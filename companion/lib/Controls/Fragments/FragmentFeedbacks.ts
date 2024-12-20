import { cloneDeep } from 'lodash-es'
import LogController, { Logger } from '../../Log/Controller.js'
import { FragmentFeedbackList } from './FragmentFeedbackList.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type { InstanceDefinitions } from '../../Instance/Definitions.js'
import type { InternalController } from '../../Internal/Controller.js'
import type { ModuleHost } from '../../Instance/Host.js'
import type { FeedbackInstance, FeedbackOwner } from '@companion-app/shared/Model/FeedbackModel.js'

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
}
