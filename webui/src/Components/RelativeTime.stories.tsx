import type { Meta, StoryObj } from '@storybook/react'
import { RelativeTime } from './RelativeTime'

const meta = {
	component: RelativeTime,
	decorators: [
		(Story) => (
			<div style={{ padding: 24, background: 'var(--color-surface)' }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof RelativeTime>

export default meta
type Story = StoryObj<typeof meta>

export const SecondsAgo: Story = {
	args: { timestamp: Date.now() - 10_000 },
}

export const DaysAgo: Story = {
	args: { timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000 },
}

export const WithTitlePrefix: Story = {
	args: { timestamp: Date.now() - 2 * 60 * 60 * 1000, titlePrefix: 'Last seen' },
}

export const DateOnlyTitle: Story = {
	args: { timestamp: Date.now() - 40 * 24 * 60 * 60 * 1000, titleFormat: 'YYYY-MM-DD' },
}
