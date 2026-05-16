import type { Meta, StoryObj } from '@storybook/react'
import { Button, LinkButton, LinkButtonExternal } from './Button'

const meta = {
	component: Button,
	args: {
		children: 'Button',
		color: 'primary',
	},
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Ghost: Story = { args: { variant: 'ghost' } }

export const Small: Story = { args: { size: 'sm' } }

export const Disabled: Story = { args: { disabled: true, children: 'Disabled' } }

export const Hidden: Story = { args: { hidden: true, children: 'Hidden (not rendered)' } }

export const AllColors: Story = {
	argTypes: {
		color: { table: { disable: true } },
		variant: { control: 'radio', options: [undefined, 'ghost', 'outline'] },
		size: { control: 'radio', options: [undefined, 'sm'] },
		disabled: { control: 'boolean' },
	},
	render: function Render({ variant, size, disabled }) {
		const colors = [
			'primary',
			'secondary',
			'success',
			'danger',
			'warning',
			'info',
			'light',
			'dark',
			'disabled',
			'link',
		] as const
		return (
			<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
				{colors.map((color) => (
					<Button key={color} color={color} variant={variant} size={size} disabled={disabled}>
						{color}
					</Button>
				))}
			</div>
		)
	},
}

export const InternalLink: StoryObj<typeof LinkButton> = {
	render: (args) => <LinkButton {...args} />,
	args: {
		children: 'Go to connections',
		color: 'primary',
		to: '/connections',
	},
}

export const ExternalLink: StoryObj<typeof LinkButtonExternal> = {
	render: (args) => <LinkButtonExternal {...args} />,
	args: {
		children: 'Open docs',
		color: 'info',
		href: 'https://bitfocus.io',
		target: '_blank',
		rel: 'noopener noreferrer',
	},
}
