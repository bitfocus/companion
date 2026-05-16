import type { Decorator, Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import type { DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import { SimpleDropdownInputField } from './DropdownInputFieldSimple'
import { MenuPortalContext } from './MenuPortalContext'

const withPortal: Decorator = (Story) => (
	<MenuPortalContext.Provider value={document.body}>
		<Story />
	</MenuPortalContext.Provider>
)

const choices = [
	{ id: 'red', label: 'Red' },
	{ id: 'green', label: 'Green' },
	{ id: 'blue', label: 'Blue' },
	{ id: 'yellow', label: 'Yellow' },
]

const meta = {
	component: SimpleDropdownInputField,
	decorators: [withPortal],
	args: {
		choices,
		value: 'red',
		setValue: () => {},
		tooltip: '',
		badOptionPrefix: '⚠ Unknown: ',
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ value: DropdownChoiceId }>()
		return <SimpleDropdownInputField {...args} setValue={(v) => setArgs({ value: v })} />
	},
} satisfies Meta<typeof SimpleDropdownInputField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Disabled: Story = {
	args: { disabled: true },
}

export const WithValidation: Story = {
	args: { checkValid: (v) => v !== 'red' },
}

/** noOptionsMessage — shown when choices list is empty */
export const NoOptions: Story = {
	args: { choices: [], value: '' as never, noOptionsMessage: 'No colours available' },
}

/** badOptionPrefix — shown before value when the current value is not in choices */
export const BadOption: Story = {
	args: { value: 'purple' as never },
}
