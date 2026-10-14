import type { Meta, StoryObj } from '@storybook/react'
import { Spinner } from './Spinner'
import { StatusBadge, type StatusBadgeTone } from './StatusBadge'

const meta = {
	component: StatusBadge,
	decorators: [
		(Story) => (
			<div style={{ padding: 24, background: 'var(--color-surface)' }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof StatusBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Good: Story = {
	args: { tone: 'good', children: 'OK' },
}

export const WithTitle: Story = {
	args: { tone: 'warning', title: 'Connection timed out after 5s', children: 'Warning' },
}

export const CustomIndicator: Story = {
	args: { tone: 'info', indicator: <Spinner size="sm" />, children: 'Starting' },
}

const TONES: StatusBadgeTone[] = ['good', 'warning', 'error', 'info', 'neutral', 'disabled']

export const AllTones: Story = {
	args: { tone: 'good', children: 'Badge' },
	render: () => (
		<div className="flex flex-wrap gap-2">
			{TONES.map((tone) => (
				<StatusBadge key={tone} tone={tone}>
					{tone}
				</StatusBadge>
			))}
		</div>
	),
}
