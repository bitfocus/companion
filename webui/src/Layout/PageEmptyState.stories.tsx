import { faAdd, faBook, faClock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { Meta, StoryObj } from '@storybook/react'
import { Button } from '~/Components/Button.js'
import { PageEmptyState } from './PageEmptyState'

const meta = {
	component: PageEmptyState,
	decorators: [
		(Story) => (
			<div className="page-shell" style={{ height: 600 }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof PageEmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		icon: faClock,
		title: 'No triggers yet',
		description: (
			<>
				<p>
					Triggers run actions automatically, without anyone pressing a button: on a schedule, when Companion starts up,
					when a variable changes, or when a condition becomes true.
				</p>
				<p>Use them to automate routine tasks, keep devices in sync, or react to events as they happen.</p>
			</>
		),
		actions: (
			<>
				<Button color="primary">
					<FontAwesomeIcon icon={faAdd} className="me-1.5" /> Add your first trigger
				</Button>
				<Button color="secondary">
					<FontAwesomeIcon icon={faBook} className="me-1.5" /> Read the guide
				</Button>
			</>
		),
	},
}
