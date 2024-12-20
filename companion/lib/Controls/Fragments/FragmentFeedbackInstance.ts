import type { FeedbackChildGroup } from '@companion-app/shared/Model/FeedbackModel.js'

export class FragmentFeedbackInstance {
	#children = new Map<FeedbackChildGroup, FragmentFeedbackList>()

	/**
	 * Recursively get all the feedbacks
	 */
	getChildrenOfGroup(groupId: FeedbackChildGroup): FragmentFeedbackInstance[] {
		return this.#children.get(groupId)?.getFeedbacks() ?? []
	}
}
