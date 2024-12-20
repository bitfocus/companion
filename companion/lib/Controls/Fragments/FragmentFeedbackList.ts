import { FragmentFeedbackInstance } from './FragmentFeedbackInstance.js'

export class FragmentFeedbackList {
	/**
	 * Get the feedbacks
	 */
	getFeedbacks(): FragmentFeedbackInstance[] {
		return this.#feedbacks
	}
}
