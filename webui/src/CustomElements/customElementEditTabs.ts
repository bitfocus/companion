export type CustomElementEditTab = 'elements' | 'inputs' | 'uses'

/** Each tab has its own path, so a view can be linked to and survives a reload. */
export const CUSTOM_ELEMENT_EDIT_TAB_PATHS = {
	elements: '/custom-elements/$controlId',
	inputs: '/custom-elements/$controlId/inputs',
	uses: '/custom-elements/$controlId/uses',
} as const satisfies Record<CustomElementEditTab, string>
