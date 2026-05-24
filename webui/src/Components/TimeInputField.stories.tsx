import type { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { TimeInputField } from './TimeInputField'

const meta = {
	component: TimeInputField,
	args: {
		id: undefined,
		value: '12:30:00',
		setValue: () => {},
		disabled: false,
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ value: string | null }>()
		return <TimeInputField {...args} setValue={(v) => setArgs({ value: v })} />
	},
} satisfies Meta<typeof TimeInputField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
	args: { value: null },
}

export const Disabled: Story = {
	args: { disabled: true },
}
