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
	args: { allowCustom: true, value: 'my-custom-value', disableEditingCustom: false },
	argTypes: {
		disableEditingCustom: { control: 'boolean' },
	},
}

export const WithValidation: Story = {
	args: { checkValid: (v) => v !== 'banana' },
}

export const Disabled: Story = {
	args: { disabled: true },
}

export const GroupedChoices: Story = {
	args: {
		choices: [
			{
				label: 'Fruits',
				options: [
					{ id: 'apple', label: 'Apple' },
					{ id: 'banana', label: 'Banana' },
				],
			},
			{
				label: 'Veggies',
				options: [
					{ id: 'carrot', label: 'Carrot' },
					{ id: 'potato', label: 'Potato' },
				],
			},
		],
		value: 'apple',
	},
}
