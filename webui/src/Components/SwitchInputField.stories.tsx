import type { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { SwitchInputField, SwitchInputFieldWithLabel } from './SwitchInputField'

const meta = {
	component: SwitchInputField,
	args: {
		value: false,
		setValue: () => {},
		tooltip: '',
		disabled: false,
		small: false,
	},
	render: function Render(args) {
		const [, setArgs] = useArgs()
		return <SwitchInputField {...args} setValue={(value) => setArgs({ value })} />
	},
} satisfies Meta<typeof SwitchInputField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Small: Story = {
	args: { small: true },
}

export const Disabled: Story = {
	args: { disabled: true, value: true },
}

export const WithLabel: Story = {
	render: function Render(args) {
		const [, setArgs] = useArgs()
		return <SwitchInputFieldWithLabel {...args} label="Enable feature" setValue={(value) => setArgs({ value })} />
	},
}

export const DisabledWithLabel: Story = {
	args: { value: true, disabled: true },
	render: function Render(args) {
		const [, setArgs] = useArgs()
		return <SwitchInputFieldWithLabel {...args} label="Enable feature" setValue={(value) => setArgs({ value })} />
	},
}
