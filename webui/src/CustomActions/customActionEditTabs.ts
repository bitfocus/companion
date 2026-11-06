export type CustomActionEditTab = 'actions' | 'inputs' | 'outputs' | 'variables' | 'uses'

/** Each tab has its own path, so a view can be linked to and survives a reload. */
export const CUSTOM_ACTION_EDIT_TAB_PATHS = {
	actions: '/custom-actions/$controlId',
	inputs: '/custom-actions/$controlId/inputs',
	outputs: '/custom-actions/$controlId/outputs',
	variables: '/custom-actions/$controlId/variables',
	uses: '/custom-actions/$controlId/uses',
} as const satisfies Record<CustomActionEditTab, string>
