import type { Decorator, Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { DropdownInputField } from './DropdownInputField'
import { MenuPortalContext } from './MenuPortalContext'

const withPortal: Decorator = (Story) => (
	<MenuPortalContext.Provider value={document.body}>
		<Story />
	</MenuPortalContext.Provider>
)

const choices = [
	{ id: 'apple', label: 'Apple' },
	{ id: 'banana', label: 'Banana' },
	{ id: 'cherry', label: 'Cherry' },
	{ id: 'date', label: 'Date' },
	{ id: 'elderberry', label: 'Elderberry' },
]

const meta = {
	component: DropdownInputField,
	decorators: [withPortal],
	args: {
		choices,
		value: 'apple',
		setValue: () => {},
		tooltip: '',
		disabled: false,
		searchLabelsOnly: true,
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ value: string }>()
		return <DropdownInputField {...args} setValue={(v) => setArgs({ value: String(v) })} />
	},
} satisfies Meta<typeof DropdownInputField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithAllowCustom: Story = {
	args: { allowCustom: true, value: 'my-custom-value' },
}

export const WithValidation: Story = {
	args: { checkValid: (v) => v !== 'banana' },
}

export const Disabled: Story = {
	args: { disabled: true },
}

/** FancyFormat uses a custom option renderer that shows the variable name and description on two lines */
export const FancyFormat: Story = {
	args: {
		fancyFormat: true,
		choices: [
			{ id: 'internal:time_hms', label: 'Current time (HH:MM:SS)' },
			{ id: 'internal:date_y', label: 'Current year' },
			{ id: 'internal:uptime', label: 'Time since last restart' },
		],
		value: 'internal:time_hms',
	},
}
