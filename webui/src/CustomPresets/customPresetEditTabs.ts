export type CustomPresetEditTab = 'actions' | 'style' | 'feedbacks' | 'variables' | 'options' | 'uses'

/** Each tab has its own path, so a view can be linked to and survives a reload. */
export const CUSTOM_PRESET_EDIT_TAB_PATHS = {
	actions: '/custom-presets/$controlId',
	style: '/custom-presets/$controlId/style',
	feedbacks: '/custom-presets/$controlId/feedbacks',
	variables: '/custom-presets/$controlId/variables',
	options: '/custom-presets/$controlId/options',
	uses: '/custom-presets/$controlId/uses',
} as const satisfies Record<CustomPresetEditTab, string>
