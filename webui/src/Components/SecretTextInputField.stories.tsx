import type { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { SecretTextInputField } from './SecretTextInputField'

const meta = {
	component: SecretTextInputField,
	args: {
		value: '',
		setValue: () => {},
		tooltip: '',
	},
	render: function Render(args) {
		const [, setArgs] = useArgs()
		return <SecretTextInputField {...args} setValue={(value) => setArgs({ value })} />
	},
} satisfies Meta<typeof SecretTextInputField>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const WithValue: Story = {
	args: {
		value: 'super-secret-password',
	},
}

export const WithValidation: Story = {
	args: {
		value: 'short',
		checkValid: (v) => v.length >= 8,
	},
}
