import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { DismissableAlert, StaticAlert } from './Alert'

const meta = {
	component: StaticAlert,
	args: {
		children: 'This is an alert message.',
		color: 'info',
	},
} satisfies Meta<typeof StaticAlert>

export default meta
type Story = StoryObj<typeof meta>

export const Info: Story = { args: { color: 'info' } }
export const Success: Story = { args: { color: 'success', children: 'Operation completed successfully.' } }
export const Warning: Story = { args: { color: 'warning', children: 'Proceed with caution.' } }
export const Danger: Story = { args: { color: 'danger', children: 'Something went wrong.' } }
export const Solid: Story = { args: { color: 'primary', variant: 'solid', children: 'Solid style alert.' } }

export const Dismissable: Story = {
	render: function Render() {
		const [visible, setVisible] = useState(true)
		return (
			<div>
				<DismissableAlert color="warning" visible={visible} onClose={() => setVisible(false)}>
					Dismiss me with the × button.
				</DismissableAlert>
				{!visible && (
					<button onClick={() => setVisible(true)} style={{ marginTop: 8 }}>
						Show again
					</button>
				)}
			</div>
		)
	},
}
