import type { Meta, StoryObj } from '@storybook/react'
import { RowButton } from './RowButton'

const meta = {
	component: RowButton,
	args: {
		title: 'Direct',
		description: 'Connect straight to another installation by its address',
		onClick: () => {},
	},
	render: (args) => (
		<div className="list-card overflow-hidden max-w-md">
			<RowButton {...args} />
		</div>
	),
} satisfies Meta<typeof RowButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Several in a card, as a list to choose from */
export const List: Story = {
	render: (args) => (
		<div className="list-card overflow-hidden max-w-md">
			<RowButton {...args} />
			<RowButton {...args} title="Studio A" description="a1b2c3d4" />
		</div>
	),
}
