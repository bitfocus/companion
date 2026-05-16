import { faCopy, faDownload, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons'
import type { Meta, StoryObj } from '@storybook/react'
import { ActionMenu } from './ActionMenu'

const meta = {
	component: ActionMenu,
	args: {
		menuItems: [],
	},
} satisfies Meta<typeof ActionMenu>

export default meta
type Story = StoryObj<typeof meta>

/** Typical menu with icons, separators and group headings */
export const Default: Story = {
	args: {
		menuItems: [
			{ label: 'Edit', icon: faEdit, do: () => console.log('edit'), tooltip: 'Edit this item' },
			{ label: 'Duplicate', icon: faCopy, do: () => console.log('duplicate') },
			{ label: 'Danger Zone', isSeparator: true },
			{ label: 'Delete', icon: faTrash, do: () => console.log('delete') },
		],
	},
}

/** Demonstrates copy-to-clipboard and external-link (inNewTab) item variants */
export const SpecialItems: Story = {
	args: {
		menuItems: [
			{
				label: 'Copy ID to clipboard',
				icon: faCopy,
				do: (): void => {},
				copyToClipboard: { text: 'item-abc-123' },
			},
			{
				label: 'Open documentation',
				icon: faDownload,
				do: () => window.open('https://companion.bitfocus.io'),
				inNewTab: true,
			},
		],
	},
}

/** Items without icons */
export const NoIcons: Story = {
	args: {
		menuItems: [
			{ label: 'Edit', icon: 'none', do: () => console.log('edit') },
			{ label: 'Delete', icon: 'none', do: () => console.log('delete') },
		],
	},
}
