import type { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { ImageInputField } from './ImageInputField'

// Minimal 1×1 red PNG as a data URL for demo purposes
const SAMPLE_PNG =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=='

const meta = {
	component: ImageInputField,
	args: {
		id: undefined,
		value: null,
		setValue: () => {},
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ value: string | null }>()
		return <ImageInputField {...args} setValue={(v) => setArgs({ value: v })} />
	},
} satisfies Meta<typeof ImageInputField>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const WithImage: Story = {
	args: { value: SAMPLE_PNG },
}

/** Constrained dimensions — min 32×32, max 128×128 */
export const WithSizeConstraints: Story = {
	args: {
		value: SAMPLE_PNG,
		min: { width: 32, height: 32 },
		max: { width: 128, height: 128 },
	},
}

export const Disabled: Story = {
	args: { disabled: true, value: SAMPLE_PNG },
}
