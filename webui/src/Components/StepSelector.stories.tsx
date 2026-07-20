import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { StepSelector, type StepSelectorItem } from './StepSelector'

const FULL_FLOW: StepSelectorItem[] = [
	{ index: 1, title: 'Surfaces' },
	{ index: 2, title: 'Button Grid' },
	{ index: 3, title: 'Services' },
	{ index: 4, title: 'Usage Stats' },
	{ index: 5, title: 'Password' },
	{ index: 6, title: 'Timezone' },
	{ index: 7, title: 'Review' },
]

const UPGRADE_FLOW: StepSelectorItem[] = [
	{ index: 1, title: 'Usage Stats', isNew: true },
	{ index: 2, title: 'Timezone', isNew: true },
	{ index: 3, title: 'Review' },
]

const meta = {
	component: StepSelector,
	decorators: [
		(Story) => (
			<div style={{ padding: 24, maxWidth: 760, background: 'var(--cui-modal-bg, #fff)' }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof StepSelector>

export default meta
type Story = StoryObj<typeof meta>

export const FullFlow: Story = {
	args: { items: FULL_FLOW, currentIndex: 1, onJump: () => {} },
}

export const MidProgress: Story = {
	args: { items: FULL_FLOW, currentIndex: 4, onJump: () => {} },
}

export const ReviewStep: Story = {
	args: { items: FULL_FLOW, currentIndex: 7, onJump: () => {} },
}

export const ShortUpgradeFlow: Story = {
	args: { items: UPGRADE_FLOW, currentIndex: 1, onJump: () => {} },
}

function InteractiveStory() {
	const [current, setCurrent] = useState(1)
	return <StepSelector items={FULL_FLOW} currentIndex={current} onJump={setCurrent} />
}

export const Interactive: Story = {
	args: { items: FULL_FLOW, currentIndex: 1, onJump: () => {} },
	render: () => <InteractiveStory />,
}
