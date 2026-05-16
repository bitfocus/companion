import type { Decorator } from '@storybook/react'
import { RootAppStoreContext, type RootAppStore } from '../src/Stores/RootAppStore'

export const mockRootAppStore: Partial<RootAppStore> = {
	notifier: {
		show: (_title, _message, _duration, _stickyId) => 'mock-notification-id',
		close: () => {},
	},
	activeLearns: new Set<string>() as unknown as RootAppStore['activeLearns'],
	userConfig: {
		properties: {
			default_export_filename: 'companion-export',
		},
	} as unknown as RootAppStore['userConfig'],
	variablesStore: {
		allVariableDefinitions: {
			get: () => [
				{ connectionLabel: 'internal', name: 'time_hms', description: 'internal:time_hms — Current time (HH:MM:SS)' },
				{ connectionLabel: 'internal', name: 'date_y', description: 'internal:date_y — Current year' },
			],
		},
	} as unknown as RootAppStore['variablesStore'],
}

export const withMockStore: Decorator = (Story) => (
	<RootAppStoreContext.Provider value={mockRootAppStore as RootAppStore}>
		<Story />
	</RootAppStoreContext.Provider>
)
