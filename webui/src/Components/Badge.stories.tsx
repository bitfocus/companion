import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from './Badge'

const meta = {
	component: Badge,
	decorators: [
		(Story) => (
			<div style={{ padding: 24, background: 'var(--color-surface)' }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Solid: Story = {
	args: { color: 'warning', children: 'Deprecated' },
}

export const Tonal: Story = {
	args: { color: 'warning', variant: 'tonal', children: 'Deprecated' },
}

const COLORS = ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'dark', 'light'] as const

export const AllColors: Story = {
	args: { color: 'primary', children: 'Badge' },
	render: () => (
		<div className="flex flex-col gap-2">
			{COLORS.map((color) => (
				<div key={color} className="flex items-center gap-2">
					<Badge color={color}>{color}</Badge>
					<Badge color={color} variant="tonal">
						{color}
					</Badge>
				</div>
			))}
		</div>
	),
}

export const InlineWithText: Story = {
	args: { color: 'warning', children: 'Deprecated' },
	render: (args) => (
		<p>
			Generic Module <Badge {...args} /> is still installed.
		</p>
	),
}
