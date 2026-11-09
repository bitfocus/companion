import type { Decorator, Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRef } from 'react'
import { withMockStore } from '../../.storybook/mockRootAppStore'
import { ConfirmExportModal, type ConfirmExportModalRef } from './ConfirmExportModal'
import { MenuPortalContext } from './MenuPortalContext'

const withPortal: Decorator = (Story) => (
	<MenuPortalContext.Provider value={document.body}>
		<Story />
	</MenuPortalContext.Provider>
)

const queryClient = new QueryClient()
const withQueryClient: Decorator = (Story) => (
	<QueryClientProvider client={queryClient}>
		<Story />
	</QueryClientProvider>
)

const meta = {
	component: ConfirmExportModal,
	decorators: [withMockStore, withPortal, withQueryClient],
} satisfies Meta<typeof ConfirmExportModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	render: function Render(args) {
		const ref = useRef<ConfirmExportModalRef | null>(null)
		return (
			<>
				<button onClick={() => ref.current?.show({ type: 'page', pageNumber: 1 })}>Open Export Modal</button>
				<ConfirmExportModal {...args} ref={ref} />
			</>
		)
	},
}
