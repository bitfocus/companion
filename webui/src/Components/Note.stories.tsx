import { faCircleCheck, faCircleExclamation, faLink, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'
import { Note, NoteDetail } from './Note'

const meta = {
	component: Note,
	decorators: [
		(Story) => (
			<div style={{ padding: 24, maxWidth: 520, background: 'var(--color-surface)' }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Note>

export default meta
type Story = StoryObj<typeof meta>

export const Neutral: Story = {
	args: {
		tone: 'neutral',
		icon: faLink,
		actions: null,
		children: 'This button is linked to a preset, and updates automatically when the preset changes.',
	},
}

export const Good: Story = {
	args: { tone: 'good', icon: faCircleCheck, actions: null, children: 'This connection requires no configuration' },
}

export const WarningWithAction: Story = {
	args: {
		tone: 'warning',
		icon: faTriangleExclamation,
		actions: (
			<Button variant="outline" size="sm">
				Install missing
			</Button>
		),
		children: '3 connections have no installed module version',
	},
}

export const DangerWithDetail: Story = {
	args: {
		tone: 'danger',
		icon: faCircleExclamation,
		actions: null,
		children: (
			<>
				Failed to build list of modules
				<NoteDetail>TypeError: Cannot read properties of undefined (reading 'display')</NoteDetail>
			</>
		),
	},
}
