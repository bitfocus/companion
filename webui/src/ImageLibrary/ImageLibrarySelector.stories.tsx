import { DragDropProvider } from '@dnd-kit/react'
import type { Decorator, Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useArgs } from 'storybook/preview-api'
import { mockRootAppStore } from '../../.storybook/mockRootAppStore'
import { ImageLibraryStore } from '../Stores/ImageLibraryStore'
import { RootAppStoreContext, type RootAppStore } from '../Stores/RootAppStore'
import { ImageLibrarySelector } from './ImageLibrarySelector'

const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: false, staleTime: Infinity } },
})

const imageLibrary = new ImageLibraryStore()
imageLibrary.updateStore([
	{
		type: 'init',
		images: [
			{
				name: 'red-background',
				description: 'Red Background',
				originalSize: 1234,
				previewSize: 512,
				createdAt: Date.now(),
				modifiedAt: Date.now(),
				checksum: 'abc123',
				mimeType: 'image/png',
				sortOrder: 0,
			},
			{
				name: 'logo-white',
				description: 'Logo (White)',
				originalSize: 2048,
				previewSize: 800,
				createdAt: Date.now(),
				modifiedAt: Date.now(),
				checksum: 'def456',
				mimeType: 'image/png',
				sortOrder: 1,
			},
			{
				name: 'company-banner',
				description: 'Company Banner',
				originalSize: 5000,
				previewSize: 1200,
				createdAt: Date.now(),
				modifiedAt: Date.now(),
				checksum: 'ghi789',
				mimeType: 'image/jpeg',
				sortOrder: 2,
			},
		],
	},
])

const mockStore = {
	...mockRootAppStore,
	imageLibrary,
} as unknown as RootAppStore

const withProviders: Decorator = (Story) => (
	<DragDropProvider>
		<QueryClientProvider client={queryClient}>
			<RootAppStoreContext.Provider value={mockStore}>
				<div style={{ width: 600, height: 400 }}>
					<Story />
				</div>
			</RootAppStoreContext.Provider>
		</QueryClientProvider>
	</DragDropProvider>
)

const meta = {
	component: ImageLibrarySelector,
	decorators: [withProviders],
	args: {
		selectedImageName: null,
		onSelectImage: () => {},
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ selectedImageName: string | null }>()
		return <ImageLibrarySelector {...args} onSelectImage={(name) => setArgs({ selectedImageName: name })} />
	},
} satisfies Meta<typeof ImageLibrarySelector>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithSelection: Story = {
	args: { selectedImageName: 'logo-white' },
}

const withEmptyLibrary: Decorator = (Story) => (
	<DragDropProvider>
		<QueryClientProvider client={queryClient}>
			<RootAppStoreContext.Provider
				value={{ ...mockRootAppStore, imageLibrary: new ImageLibraryStore() } as unknown as RootAppStore}
			>
				<div style={{ width: 600, height: 400 }}>
					<Story />
				</div>
			</RootAppStoreContext.Provider>
		</QueryClientProvider>
	</DragDropProvider>
)

export const Empty: Story = {
	decorators: [withEmptyLibrary],
}
