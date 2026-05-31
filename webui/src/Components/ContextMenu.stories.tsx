import { faEdit, faTrash } from '@fortawesome/free-solid-svg-icons'
import type { Meta, StoryObj } from '@storybook/react'
import { ContextMenu } from './ContextMenu'

const meta = {
	component: ContextMenu,
	args: {
		open: true,
		onOpenChange: () => {},
		position: { x: 20, y: 20 },
		menuItems: [],
	},
} satisfies Meta<typeof ContextMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	render: function Render(args) {
		return (
			<ContextMenu
				{...args}
				open={true}
				position={{ x: 20, y: 20 }}
				onOpenChange={() => {}}
				menuItems={[
					{ label: 'Edit', icon: faEdit, do: () => console.log('edit') },
					{ isSeparator: true },
					{ label: 'Delete', icon: faTrash, do: () => console.log('delete') },
				]}
			/>
		)
	},
}

export const Hidden: Story = {
	render: function Render(args) {
		return (
			<ContextMenu
				{...args}
				open={false}
				position={{ x: 20, y: 20 }}
				onOpenChange={() => {}}
				menuItems={[{ label: 'Edit', icon: faEdit, do: () => console.log('edit') }]}
			/>
		)
	},
}
