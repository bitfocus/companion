import { faEdit, faTrash } from '@fortawesome/free-solid-svg-icons'
import type { Meta, StoryObj } from '@storybook/react'
import { useRef } from 'react'
import { ContextMenu } from './ContextMenu'

const meta = {
	component: ContextMenu,
	args: {
		visible: true,
		position: { x: 20, y: 20 },
		onContextMenu: (e: React.MouseEvent<HTMLDivElement>) => e.preventDefault(),
		menuItems: [],
		menuRef: { current: null },
	},
} satisfies Meta<typeof ContextMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	render: function Render(args) {
		const menuRef = useRef<HTMLDivElement>(null)
		return (
			<ContextMenu
				{...args}
				visible={true}
				position={{ x: 20, y: 20 }}
				menuRef={menuRef}
				onContextMenu={(e) => e.preventDefault()}
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
		const menuRef = useRef<HTMLDivElement>(null)
		return (
			<ContextMenu
				{...args}
				visible={false}
				position={{ x: 20, y: 20 }}
				menuRef={menuRef}
				onContextMenu={(e) => e.preventDefault()}
				menuItems={[{ label: 'Edit', icon: faEdit, do: () => console.log('edit') }]}
			/>
		)
	},
}
