export type ConnectionEditTab = 'settings' | 'docs' | 'diagnostics'

/** Each tab has its own path, so a view can be linked to and survives a reload. */
export const CONNECTION_EDIT_TAB_PATHS = {
	settings: '/connections/$connectionId',
	docs: '/connections/$connectionId/docs',
	diagnostics: '/connections/$connectionId/diagnostics',
} as const satisfies Record<ConnectionEditTab, string>
