import type { Decorator, Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { mockRootAppStore } from '../../.storybook/mockRootAppStore'
import { RootAppStoreContext, type RootAppStore } from '../Stores/RootAppStore'
import { ButtonGridResizePrompt } from './ButtonGridResizePrompt'

const queryClient = new QueryClient()

const withQueryClient: Decorator = (Story) => (
	<QueryClientProvider client={queryClient}>
		<Story />
	</QueryClientProvider>
)

const gridSize = { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 }

const withOverflowStore: Partial<RootAppStore> = {
	...mockRootAppStore,
	userConfig: {
		properties: {
			...mockRootAppStore.userConfig?.properties,
			gridSize,
		},
	} as unknown as RootAppStore['userConfig'],
	surfaces: {
		getSurfacesOverflowingBounds: () => ({
			neededBounds: { minColumn: 0, maxColumn: 11, minRow: 0, maxRow: 5 },
			surfaces: [
				{ id: 'surface-1', displayName: 'Stream Deck XL (desk)' },
				{ id: 'surface-2', displayName: 'Loupedeck Live (rack)' },
			],
		}),
	} as unknown as RootAppStore['surfaces'],
}

const withNoOverflowStore: Partial<RootAppStore> = {
	...mockRootAppStore,
	userConfig: {
		properties: {
			...mockRootAppStore.userConfig?.properties,
			gridSize,
		},
	} as unknown as RootAppStore['userConfig'],
	surfaces: {
		getSurfacesOverflowingBounds: () => ({
			neededBounds: gridSize,
			surfaces: [],
		}),
	} as unknown as RootAppStore['surfaces'],
}

const withOverflowDecorator: Decorator = (Story) => (
	<RootAppStoreContext.Provider value={withOverflowStore as RootAppStore}>
		<Story />
	</RootAppStoreContext.Provider>
)

const withNoOverflowDecorator: Decorator = (Story) => (
	<RootAppStoreContext.Provider value={withNoOverflowStore as RootAppStore}>
		<Story />
	</RootAppStoreContext.Provider>
)

const meta = {
	component: ButtonGridResizePrompt,
	decorators: [withQueryClient],
} satisfies Meta<typeof ButtonGridResizePrompt>

export default meta
type Story = StoryObj<typeof meta>

/** Surfaces overflow the grid — shows the resize prompt with affected surface names */
export const WithOverflowingSurfaces: Story = {
	decorators: [withOverflowDecorator],
}

/** No surfaces overflow the grid — component renders nothing */
export const NoOverflowingSurfaces: Story = {
	decorators: [withNoOverflowDecorator],
}
