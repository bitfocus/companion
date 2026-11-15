import { faPlug } from '@fortawesome/free-solid-svg-icons'
import type { Meta, StoryObj } from '@storybook/react'
import { PanelEmptyState } from './PanelEmptyState'

const meta = {
	component: PanelEmptyState,
	decorators: [
		(Story) => (
			<div style={{ padding: 24, maxWidth: 640, height: 400, background: 'var(--color-surface-muted)' }}>
				<div className="secondary-panel-simple">
					<Story />
				</div>
			</div>
		),
	],
} satisfies Meta<typeof PanelEmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const NothingSelected: Story = {
	args: {
		icon: faPlug,
		title: 'No connection selected',
		description: 'Select a connection from the list to edit its settings.',
	},
}
