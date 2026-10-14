import { faGamepad, faSquareRootVariable } from '@fortawesome/free-solid-svg-icons'
import type { Meta, StoryObj } from '@storybook/react'
import { StatusBadge } from '~/Components/StatusBadge'
import { PanelHeader } from './PanelHeader'
import { CloseButton, ContextHelpButton } from './PanelIcons'

const meta = {
	component: PanelHeader,
	decorators: [
		(Story) => (
			<div style={{ padding: 24, maxWidth: 640, background: 'var(--color-surface-muted)' }}>
				<div className="secondary-panel-simple">
					<Story />
					<div className="secondary-panel-simple-body">Panel content</div>
				</div>
			</div>
		),
	],
} satisfies Meta<typeof PanelHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		icon: faGamepad,
		title: 'Settings for Stream Deck XL',
		children: <CloseButton closeFn={() => {}} />,
	},
}

export const WithHelpAndBadge: Story = {
	args: {
		icon: faSquareRootVariable,
		title: 'Edit Expression Variable',
		children: (
			<>
				<StatusBadge tone="good">Valid</StatusBadge>
				<ContextHelpButton action="/user-guide/variables" />
				<CloseButton closeFn={() => {}} />
			</>
		),
	},
}

export const LongTitle: Story = {
	args: {
		icon: faGamepad,
		title: 'Settings for a surface with a very long display name that will not fit on one line in the panel',
		children: <CloseButton closeFn={() => {}} />,
	},
}
