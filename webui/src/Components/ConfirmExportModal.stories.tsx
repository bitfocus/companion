import type { Decorator, Meta, StoryObj } from '@storybook/react'
import { useRef } from 'react'
import { withMockStore } from '../../.storybook/mockRootAppStore'
import { ConfirmExportModal, type ConfirmExportModalRef } from './ConfirmExportModal'
import { MenuPortalContext } from './MenuPortalContext'

const withPortal: Decorator = (Story) => (
	<MenuPortalContext.Provider value={document.body}>
		<Story />
	</MenuPortalContext.Provider>
)

const meta = {
	component: ConfirmExportModal,
	decorators: [withMockStore, withPortal],
} satisfies Meta<typeof ConfirmExportModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	render: function Render(args) {
		const ref = useRef<ConfirmExportModalRef | null>(null)
		return (
			<>
				<button onClick={() => ref.current?.show('/api/export/config')}>Open Export Modal</button>
				<ConfirmExportModal {...args} ref={ref} />
			</>
		)
	},
}

export const WithTitle: Story = {
	args: { title: 'Export Page Configuration' },
	render: function Render(args) {
		const ref = useRef<ConfirmExportModalRef | null>(null)
		return (
			<>
				<button onClick={() => ref.current?.show('/api/export/page/1')}>Open Export Modal</button>
				<ConfirmExportModal {...args} ref={ref} />
			</>
		)
	},
}
