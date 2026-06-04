import type { Decorator, Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useArgs } from 'storybook/preview-api'
import { mockRootAppStore } from '../../.storybook/mockRootAppStore'
import { trpc } from '../Resources/TRPC'
import { ImageLibraryStore } from '../Stores/ImageLibraryStore'
import { RootAppStoreContext, type RootAppStore } from '../Stores/RootAppStore'
import { ImageInputField } from './ImageInputField'

// Minimal 1×1 red PNG as a data URL for demo purposes
const SAMPLE_PNG =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQAWJ84A0+ScZRAxiGSRgQSAb40wkoDAgBvAlt1AAGcEIiBGgbiAAgXwixcH9GzgAAAABJRU5ErkJggg=='

const SAMPLE_IMAGE_ID = 'my-sample-image'
const SAMPLE_CHECKSUM = 'abc123'

const imageLibrary = new ImageLibraryStore()
imageLibrary.updateStore([
	{
		type: 'init',
		images: [
			{
				name: SAMPLE_IMAGE_ID,
				description: 'Sample Library Image',
				originalSize: 1234,
				previewSize: 512,
				createdAt: Date.now(),
				modifiedAt: Date.now(),
				checksum: SAMPLE_CHECKSUM,
				mimeType: 'image/png',
				sortOrder: 0,
			},
		],
	},
])

const mockStore = {
	...mockRootAppStore,
	imageLibrary,
} as unknown as RootAppStore

const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: false, staleTime: Infinity } },
})

// Pre-seed the query cache so LibraryImageThumbnail renders the image instead of a spinner
queryClient.setQueryData(
	trpc.imageLibrary.getData.queryOptions({ imageName: SAMPLE_IMAGE_ID, type: 'preview' }).queryKey,
	{ image: SAMPLE_PNG, checksum: SAMPLE_CHECKSUM }
)

const withProviders: Decorator = (Story) => (
	<QueryClientProvider client={queryClient}>
		<RootAppStoreContext.Provider value={mockStore}>
			<Story />
		</RootAppStoreContext.Provider>
	</QueryClientProvider>
)

const meta = {
	component: ImageInputField,
	decorators: [withProviders],
	args: {
		id: undefined,
		value: null,
		setValue: () => {},
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ value: string | null }>()
		return <ImageInputField {...args} setValue={(v) => setArgs({ value: v })} />
	},
} satisfies Meta<typeof ImageInputField>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const WithInlineImage: Story = {
	args: { value: SAMPLE_PNG },
}

/** References a library image — thumbnail rendered from pre-seeded query cache */
export const WithLibraryImage: Story = {
	args: { value: `$(image:${SAMPLE_IMAGE_ID})` },
}

/** Constrained dimensions — min 32×32, max 128×128 */
export const WithSizeConstraints: Story = {
	args: {
		value: SAMPLE_PNG,
		min: { width: 32, height: 32 },
		max: { width: 128, height: 128 },
	},
}

export const Disabled: Story = {
	args: { disabled: true, value: SAMPLE_PNG },
}
