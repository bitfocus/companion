import type { Decorator, Meta, StoryObj } from '@storybook/react'
import { AddDropdown } from './AddDropdown'
import { MenuPortalContext } from './MenuPortalContext'

const withPortal: Decorator = (Story) => (
	<MenuPortalContext.Provider value={document.body}>
		<Story />
	</MenuPortalContext.Provider>
)

const meta = {
	component: AddDropdown,
	decorators: [withPortal],
	args: {
		choices: [
			{ id: 'startup', label: 'Startup' },
			{ id: 'interval', label: 'Time interval' },
			{ id: 'timeofday', label: 'Time of day' },
			{ id: 'variable_changed', label: 'On variable change' },
		],
		placeholder: '+ Add event',
		noOptionsMessage: 'No events found',
		onSelect: () => {},
	},
} satisfies Meta<typeof AddDropdown>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** noOptionsMessage — shown when there is nothing which can be added */
export const NoOptions: Story = {
	args: { choices: [] },
}
