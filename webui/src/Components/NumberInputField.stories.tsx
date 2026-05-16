import type { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { NumberInputField } from './NumberInputField'

const meta = {
	component: NumberInputField,
	args: {
		value: 0,
		setValue: () => {},
		tooltip: '',
		disabled: false,
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ value: number }>()
		return <NumberInputField {...args} setValue={(v) => setArgs({ value: v })} />
	},
} satisfies Meta<typeof NumberInputField>

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = { args: { value: 42 } }

export const WithMinMax: Story = {
	args: { value: 50, min: 0, max: 100 },
}

export const WithStep: Story = {
	args: { value: 5, min: 0, max: 20, step: 5 },
}

export const WithRange: Story = {
	args: { value: 30, min: 0, max: 100, range: true },
}

export const WithValidation: Story = {
	args: {
		value: 3,
		min: 1,
		max: 10,
		checkValid: (v: number) => v >= 1 && v <= 10,
	},
}

export const InfinityOverlays: Story = {
	args: {
		value: 0,
		min: 0,
		max: 100,
		showMinAsNegativeInfinity: true,
		showMaxAsPositiveInfinity: true,
	},
}

export const Disabled: Story = {
	args: { value: 7, disabled: true },
}
