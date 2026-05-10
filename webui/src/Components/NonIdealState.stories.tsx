import { faExclamationTriangle, faSearch, faTrash, faWifi } from '@fortawesome/free-solid-svg-icons'
import type { Meta, StoryObj } from '@storybook/react'
import { NonIdealState } from './NonIdealState'

const meta = {
	component: NonIdealState,
	args: {
		icon: faTrash,
	},
} satisfies Meta<typeof NonIdealState>

export default meta
type Story = StoryObj<typeof meta>

export const WithText: Story = {
	args: { text: 'Nothing to show here.' },
}

export const NoResults: Story = {
	args: { icon: faSearch, text: 'No results found.' },
}

export const Warning: Story = {
	args: { icon: faExclamationTriangle, text: 'Something went wrong.' },
}

export const WithChildren: Story = {
	args: {
		icon: faWifi,
		children: (
			<>
				Not connected.{' '}
				<a href="#" onClick={(e) => e.preventDefault()}>
					Retry
				</a>
			</>
		),
	},
}
