import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Collapse, type CollapseRootProps } from './Collapse'

const meta = {
	component: Collapse.Root,
	decorators: [
		(Story) => (
			<div style={{ padding: 40 }}>
				<Story />
			</div>
		),
	],
	render: (args: CollapseRootProps) => (
		<Collapse.Root {...args}>
			<Collapse.Trigger>Toggle</Collapse.Trigger>
			<Collapse.Panel>
				<div style={{ padding: '16px', background: 'var(--cui-secondary-bg)', borderRadius: 4 }}>
					<p style={{ margin: 0 }}>Collapsed content. This area can contain any content.</p>
				</div>
			</Collapse.Panel>
		</Collapse.Root>
	),
} satisfies Meta<typeof Collapse.Root>

export default meta
type Story = StoryObj<typeof meta>

/** Collapsed by default — click the trigger to expand. */
export const Default: Story = {}

/** Panel open on load. */
export const OpenByDefault: Story = {
	args: { defaultOpen: true },
}

function ControlledStory() {
	const [open, setOpen] = useState(false)
	return (
		<div>
			<button onClick={() => setOpen((v) => !v)} style={{ marginBottom: 12 }}>
				{open ? 'Hide details' : 'Show details'}
			</button>
			<Collapse.Root open={open} onOpenChange={setOpen}>
				<Collapse.Panel>
					<div style={{ padding: 16, background: 'var(--cui-secondary-bg)', borderRadius: 4 }}>
						<p style={{ margin: 0 }}>This panel is driven by external state, with no built-in trigger.</p>
					</div>
				</Collapse.Panel>
			</Collapse.Root>
		</div>
	)
}

/** Controlled — an external button drives the open state. */
export const Controlled: Story = {
	render: () => <ControlledStory />,
}

/** Multiple independent panels. */
export const MultiplePanels: Story = {
	render: () => (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
			<Collapse.Root defaultOpen>
				<Collapse.Trigger>Section A</Collapse.Trigger>
				<Collapse.Panel>
					<div style={{ padding: 12, background: 'var(--cui-secondary-bg)', borderRadius: 4 }}>
						Content for section A.
					</div>
				</Collapse.Panel>
			</Collapse.Root>
			<Collapse.Root>
				<Collapse.Trigger>Section B</Collapse.Trigger>
				<Collapse.Panel>
					<div style={{ padding: 12, background: 'var(--cui-secondary-bg)', borderRadius: 4 }}>
						Content for section B.
					</div>
				</Collapse.Panel>
			</Collapse.Root>
		</div>
	),
}
