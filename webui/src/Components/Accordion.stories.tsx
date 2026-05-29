import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Accordion, type AccordionRootProps } from './Accordion'

const meta = {
	component: Accordion.Root,
	decorators: [
		(Story) => (
			<div style={{ padding: 40, maxWidth: 420 }}>
				<Story />
			</div>
		),
	],
	render: (args: AccordionRootProps<unknown>) => (
		<Accordion.Root {...args}>
			<Accordion.Item value="connection-a">
				<Accordion.Header>
					<Accordion.Trigger>Connection A</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Panel>
					<div style={{ padding: '8px 0' }}>Element list for Connection A</div>
				</Accordion.Panel>
			</Accordion.Item>
			<Accordion.Item value="connection-b">
				<Accordion.Header>
					<Accordion.Trigger>Connection B</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Panel>
					<div style={{ padding: '8px 0' }}>Element list for Connection B</div>
				</Accordion.Panel>
			</Accordion.Item>
		</Accordion.Root>
	),
} satisfies Meta<typeof Accordion.Root>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const OpenByDefault: Story = {
	args: {
		defaultValue: ['connection-a'],
	},
}

function ControlledStory() {
	const [value, setValue] = useState<unknown[]>([])

	return (
		<div>
			<button
				onClick={() => setValue((prev) => (prev.length > 0 ? [] : ['connection-a']))}
				style={{ marginBottom: 12 }}
			>
				{value.length > 0 ? 'Close from outside' : 'Open from outside'}
			</button>
			<Accordion.Root value={value} onValueChange={setValue}>
				<Accordion.Item value="connection-a">
					<Accordion.Header>
						<Accordion.Trigger>Connection A</Accordion.Trigger>
					</Accordion.Header>
					<Accordion.Panel>
						<div style={{ padding: '8px 0' }}>Controlled accordion content</div>
					</Accordion.Panel>
				</Accordion.Item>
			</Accordion.Root>
		</div>
	)
}

export const Controlled: Story = {
	render: () => <ControlledStory />,
}

export const MultipleOpen: Story = {
	args: {
		multiple: true,
		defaultValue: ['connection-a', 'connection-b'],
	},
}
