import { FragmentFeedbackList } from './FragmentFeedbackList.js'
import type { FeedbackChildGroup, FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import type { FeedbackDefinition } from '@companion-app/shared/Model/FeedbackDefinitionModel.js'

export class FragmentFeedbackInstance {
	readonly #data: Omit<FeedbackInstance, 'children' | 'advancedChildren'>

	#children = new Map<FeedbackChildGroup, FragmentFeedbackList>()

	/**
	 * Get the definition for this feedback
	 */
	getDefinition(): FeedbackDefinition | undefined {
		return this.#instanceDefinitions.getFeedbackDefinition(this.#data.instance_id, this.#data.type)
	}

	/**
	 * Recursively get all the feedbacks
	 */
	getChildrenOfGroup(groupId: FeedbackChildGroup): FragmentFeedbackInstance[] {
		return this.#children.get(groupId)?.getFeedbacks() ?? []
	}

	/**
	 * Replace portions of the feedback with an updated version
	 */
	replaceProps(
		newProps: Pick<FeedbackInstance, 'type' | 'style' | 'options' | 'isInverted'>,
		skipNotifyModule = false
	): void {
		this.#data.type = newProps.type // || newProps.feedbackId
		this.#data.options = newProps.options
		this.#data.isInverted = !!newProps.isInverted

		delete this.#data.upgradeIndex

		// Preserve existing value if it is set
		this.#data.style = Object.keys(this.#data.style || {}).length > 0 ? this.#data.style : newProps.style

		if (!skipNotifyModule) {
			this.subscribe(false)
		}
	}
}
