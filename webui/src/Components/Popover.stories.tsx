import type { Meta, StoryObj } from '@storybook/react'
import { Popover } from './Popover'

const meta = {
	component: Popover,
	args: {
		content: 'This is the popover content.',
		children: <span style={{ textDecoration: 'underline', cursor: 'default' }}>hover me</span>,
	},
} satisfies Meta<typeof Popover>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Immediate: Story = {
	args: { hoverWait: 0 },
}

export const LongWait: Story = {
	args: { hoverWait: 1500, content: 'This popover takes 1.5s to appear.' },
}
