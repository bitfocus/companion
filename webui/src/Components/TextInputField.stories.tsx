import type { Decorator, Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { withMockStore } from '../../.storybook/mockRootAppStore'
import { MenuPortalContext } from './MenuPortalContext'
import { TextInputField } from './TextInputField'

const meta = {
	component: TextInputField,
	args: {
		value: '',
		setValue: () => {},
		tooltip: '',
		disabled: false,
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ value: string }>()
		return <TextInputField {...args} setValue={(v) => setArgs({ value: v })} />
	},
} satisfies Meta<typeof TextInputField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithPlaceholder: Story = {
	args: { placeholder: 'Type something…' },
}

export const Multiline: Story = {
	args: { multiline: true, value: 'Line one\nLine two' },
}

export const WithValidation: Story = {
	args: {
		value: 'hi',
		checkValid: (v) => v.length >= 5,
	},
}

export const Disabled: Story = {
	args: { value: 'Read-only text', disabled: true },
}

const withMenuPortalDecorator: Decorator = (Story) => (
	<MenuPortalContext.Provider value={document.body}>
		<Story />
	</MenuPortalContext.Provider>
)

const withVariablesDecorators: Decorator[] = [withMockStore, withMenuPortalDecorator]

export const WithVariables: Story = {
	decorators: withVariablesDecorators,
	args: { useVariables: true, value: '$(internal:time_hms)' },
}

export const WithVariablesAndLocalVars: Story = {
	decorators: withVariablesDecorators,
	args: {
		useVariables: true,
		value: '$(local:pressed)',
		localVariables: [
			{ value: 'local:pressed', label: 'pressed — Whether the button is pressed' },
			{ value: 'local:surface_id', label: 'surface_id — ID of the triggering surface' },
		],
	},
}
