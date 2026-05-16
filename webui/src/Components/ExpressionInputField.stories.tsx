import type { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { withMockStore } from '../../.storybook/mockRootAppStore'
import { ExpressionInputField } from './ExpressionInputField'

const meta = {
	component: ExpressionInputField,
	decorators: [withMockStore],
	args: {
		value: '',
		setValue: () => {},
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ value: string }>()
		return (
			<div style={{ height: 80 }}>
				<ExpressionInputField {...args} setValue={(v) => setArgs({ value: v })} />
			</div>
		)
	},
} satisfies Meta<typeof ExpressionInputField>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const WithExpression: Story = {
	args: { value: '$(internal:time_hms) + 1' },
}

export const InvalidExpression: Story = {
	args: { value: '$(foo:bar +' },
}

export const Disabled: Story = {
	args: { value: '$(internal:time_hms)', disabled: true },
}

export const WithLocalVariables: Story = {
	args: {
		value: '$(local:pressed)',
		localVariables: [
			{ value: 'local:pressed', label: 'pressed — Whether the button is pressed' },
			{ value: 'local:surface_id', label: 'surface_id — ID of the triggering surface' },
		],
	},
}
