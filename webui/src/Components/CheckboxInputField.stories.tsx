import type { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { CheckboxInputField, CheckboxInputFieldWithLabel } from './CheckboxInputField'

const meta = {
	component: CheckboxInputField,
	args: {
		value: false,
		setValue: () => {},
		tooltip: '',
		disabled: false,
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ value: boolean }>()
		return <CheckboxInputField {...args} setValue={(v) => setArgs({ value: v })} />
	},
} satisfies Meta<typeof CheckboxInputField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Indeterminate: Story = { args: { indeterminate: true } }
export const Disabled: Story = { args: { disabled: true, value: true } }

export const WithLabel: Story = {
	render: function Render(args) {
		const [, setArgs] = useArgs<{ value: boolean }>()
		return <CheckboxInputFieldWithLabel {...args} label="Enable feature" setValue={(v) => setArgs({ value: v })} />
	},
}

export const DisabledWithLabel: Story = {
	args: { value: true, disabled: true },
	render: function Render(args) {
		const [, setArgs] = useArgs<{ value: boolean }>()
		return <CheckboxInputFieldWithLabel {...args} label="Enable feature" setValue={(v) => setArgs({ value: v })} />
	},
}
