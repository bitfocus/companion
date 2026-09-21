import { faFlask, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from './Badge'

const meta = {
	component: Badge,
	decorators: [
		(Story) => (
			<div style={{ padding: 40 }}>
				<Story />
			</div>
		),
	],
	args: {
		color: 'warning',
		children: 'Deprecated',
	},
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithIcon: Story = {
	args: {
		icon: faTriangleExclamation,
	},
}

export const AllColors: Story = {
	render: () => (
		<div className="flex flex-row items-center gap-2">
			<Badge color="primary">Primary</Badge>
			<Badge color="secondary">Secondary</Badge>
			<Badge color="success">Success</Badge>
			<Badge color="info" icon={faFlask}>
				Beta
			</Badge>
			<Badge color="warning" icon={faTriangleExclamation}>
				Deprecated
			</Badge>
			<Badge color="danger">Danger</Badge>
			<Badge color="light">Light</Badge>
			<Badge color="dark">Dark</Badge>
		</div>
	),
}
