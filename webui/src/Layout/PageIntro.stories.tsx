import type { Meta, StoryObj } from '@storybook/react'
import { PageIntro } from './PageIntro'

const meta = {
	component: PageIntro,
	decorators: [
		(Story) => (
			<div style={{ padding: 24, maxWidth: 720, background: 'var(--color-surface)' }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof PageIntro>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		title: 'Configuration Management',
		children: 'Export custom configuration backups, restore from a snapshot, or reset Companion configuration.',
	},
}
