import type { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { DateInputField } from './DateInputField'

const meta = {
	component: DateInputField,
	args: {
		id: undefined,
		value: new Date(),
		setValue: () => {},
		disabled: false,
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ value: Date | null }>()
		return <DateInputField {...args} setValue={(v) => setArgs({ value: v })} />
	},
} satisfies Meta<typeof DateInputField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
	args: { value: null },
}

export const Disabled: Story = {
	args: { disabled: true },
}
