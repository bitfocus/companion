export type CustomFeedbackEditTab = 'feedbacks' | 'inputs' | 'variables' | 'uses'

/** Each tab has its own path, so a view can be linked to and survives a reload. */
export const CUSTOM_FEEDBACK_EDIT_TAB_PATHS = {
	feedbacks: '/custom-feedbacks/$controlId',
	inputs: '/custom-feedbacks/$controlId/inputs',
	variables: '/custom-feedbacks/$controlId/variables',
	uses: '/custom-feedbacks/$controlId/uses',
} as const satisfies Record<CustomFeedbackEditTab, string>
