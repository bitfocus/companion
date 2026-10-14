import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'
import { EditSectionCard } from './EditSectionCard'

const meta = {
	component: EditSectionCard,
	decorators: [
		(Story) => (
			<div style={{ padding: 24, maxWidth: 560, background: 'var(--color-surface)' }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof EditSectionCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		title: 'General Settings',
		children: <p className="text-sm text-muted">The connection's label, enabled state and module version.</p>,
	},
}

export const WithSummary: Story = {
	args: {
		title: 'Configuration',
		summary: '4 fields',
		children: <p className="text-sm text-muted">Module-specific configuration fields go here.</p>,
	},
}

export const Danger: Story = {
	args: {
		title: 'Danger Zone',
		danger: true,
		children: (
			<div className="flex items-center justify-between gap-2">
				<span className="text-sm">Delete this connection and all its actions and feedbacks.</span>
				<Button color="danger" size="sm">
					Delete
				</Button>
			</div>
		),
	},
}
