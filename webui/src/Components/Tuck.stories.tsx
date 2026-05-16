import type { Meta, StoryObj } from '@storybook/react'
import { Tuck } from './Tuck'

const meta = {
	component: Tuck,
} satisfies Meta<typeof Tuck>

export default meta
type Story = StoryObj<typeof meta>

export const Number: Story = { args: { children: '1' } }
export const Letter: Story = { args: { children: 'A' } }
export const Symbol: Story = { args: { children: '★' } }
export const InContext: Story = {
	args: { children: '' },
	render: () => (
		<div>
			<Tuck>1</Tuck> First item
			<br />
			<Tuck>2</Tuck> Second item
			<br />
			<Tuck>3</Tuck> Third item
		</div>
	),
}
