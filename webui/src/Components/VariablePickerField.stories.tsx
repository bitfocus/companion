import type { Decorator, Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { MenuPortalContext } from './MenuPortalContext'
import { VariablePickerField } from './VariablePickerField'

const withPortal: Decorator = (Story) => (
	<MenuPortalContext.Provider value={document.body}>
		<Story />
	</MenuPortalContext.Provider>
)

const choices = [
	{ id: 'internal:time_hms', label: 'Current time (HH:MM:SS)' },
	{ id: 'internal:date_y', label: 'Current year' },
	{ id: 'internal:uptime', label: 'Time since last restart' },
	{ id: 'custom:var1', label: 'My Custom Variable' },
]

const meta = {
	component: VariablePickerField,
	decorators: [withPortal],
	args: {
		choices,
		value: 'internal:time_hms',
		setValue: () => {},
		disabled: false,
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ value: string }>()
		return <VariablePickerField {...args} setValue={(v) => setArgs({ value: String(v) })} />
	},
} satisfies Meta<typeof VariablePickerField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithAllowCustom: Story = {
	args: { allowCustom: true, value: 'my-custom:value' },
}

export const Disabled: Story = {
	args: { disabled: true },
}

export const GroupedChoices: Story = {
	args: {
		choices: [
			{
				label: 'Date & Time',
				options: [
					{ id: 'internal:time_hms', label: 'Current time (HH:MM:SS)' },
					{ id: 'internal:date_y', label: 'Current year' },
				],
			},
			{
				label: 'System',
				options: [
					{ id: 'internal:uptime', label: 'Time since last restart' },
					{ id: 'internal:hostname', label: 'Hostname' },
				],
			},
		],
		value: 'internal:time_hms',
	},
}
