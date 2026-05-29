import type { Meta, StoryObj } from '@storybook/react'
import { CopyButton } from './CopyButton'

const meta = {
	component: CopyButton,
	args: {
		text: 'Hello, world!',
	},
} satisfies Meta<typeof CopyButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CustomTitle: Story = {
	args: { title: 'Copy variable name' },
}

export const WithColor: Story = {
	args: { color: 'secondary' },
}

export const LargeSize: Story = {
	args: { size: 'lg', text: '$(my_module:my_variable)' },
}

export const VariableName: Story = {
	args: { text: '$(internal:time_hms)', title: 'Copy variable name' },
}
