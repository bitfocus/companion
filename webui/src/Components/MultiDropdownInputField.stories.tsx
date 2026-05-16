import type { Decorator, Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import type { DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import { MenuPortalContext } from './MenuPortalContext'
import { MultiDropdownInputField } from './MultiDropdownInputField'

const withPortal: Decorator = (Story) => (
	<MenuPortalContext.Provider value={document.body}>
		<Story />
	</MenuPortalContext.Provider>
)

const choices = [
	{ id: 'mon', label: 'Monday' },
	{ id: 'tue', label: 'Tuesday' },
	{ id: 'wed', label: 'Wednesday' },
	{ id: 'thu', label: 'Thursday' },
	{ id: 'fri', label: 'Friday' },
]

const meta = {
	component: MultiDropdownInputField,
	decorators: [withPortal],
	args: {
		choices,
		value: ['mon'],
		setValue: () => {},
		tooltip: '',
		disabled: false,
		allowCustom: false,
		sortSelection: false,
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ value: DropdownChoiceId[] }>()
		return <MultiDropdownInputField {...args} setValue={(v) => setArgs({ value: v })} />
	},
} satisfies Meta<typeof MultiDropdownInputField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const MultipleSelected: Story = {
	args: { value: ['mon', 'wed', 'fri'] },
}

export const WithMinMax: Story = {
	args: { value: ['mon', 'tue'], minSelection: 1, maxSelection: 3 },
}

/** sortSelection — selected tags are kept alphabetically sorted */
export const SortedSelection: Story = {
	args: { value: ['fri', 'mon', 'wed'], sortSelection: true },
}

/** allowCustom — user can type and add values not in the choices list */
export const WithCustomValues: Story = {
	args: { allowCustom: true, value: ['mon', 'my-custom-day'] },
}

export const WithValidation: Story = {
	args: { value: ['mon', 'tue'], checkValid: (v) => !v.includes('fri') },
}

export const Disabled: Story = {
	args: { disabled: true, value: ['mon', 'wed'] },
}

const tenThousandChoices = Array.from({ length: 10000 }, (_, i) => ({ id: `item-${i}`, label: `Item ${i}` }))

/** 10 000 items — tests windowed / virtualised menu list performance */
export const TenThousandItems: Story = {
	args: { choices: tenThousandChoices, value: ['item-0', 'item-42'] },
}
