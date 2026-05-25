import type { Meta, StoryObj } from '@storybook/react'
import type { ComponentProps } from 'react'
import { Button } from './Button'
import { Tooltip } from './Tooltip'

type RootArgs = ComponentProps<typeof Tooltip.Root>

const meta = {
	component: Tooltip.Root,
	decorators: [
		(Story) => (
			<div style={{ padding: 80, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
				<Story />
			</div>
		),
	],
	render: (args: RootArgs) => (
		<Tooltip.Root {...args}>
			<Tooltip.Trigger render={<Button color="secondary">Hover me</Button>} />
			<Tooltip.Popup arrow>Tooltip content</Tooltip.Popup>
		</Tooltip.Root>
	),
} satisfies Meta<typeof Tooltip.Root>

export default meta
type Story = StoryObj<typeof meta>

/** Default — hover the button to reveal the tooltip. */
export const Default: Story = {}

/** Open immediately so the tooltip is visible in the canvas. */
export const OpenByDefault: Story = {
	args: { defaultOpen: true },
}

/** Without an arrow. */
export const NoArrow: Story = {
	args: { defaultOpen: true },
	render: (args: RootArgs) => (
		<Tooltip.Root {...args}>
			<Tooltip.Trigger render={<Button color="secondary">Hover me</Button>} />
			<Tooltip.Popup>Tooltip content</Tooltip.Popup>
		</Tooltip.Root>
	),
}

/** Multi-line text with medium width constraint. */
export const MultiLineMd: Story = {
	args: { defaultOpen: true },
	render: (args: RootArgs) => (
		<Tooltip.Root {...args}>
			<Tooltip.Trigger render={<Button color="secondary">Hover me</Button>} />
			<Tooltip.Popup arrow size="md">
				This is a longer tooltip that wraps across multiple lines to show how the md size modifier constrains the width.
			</Tooltip.Popup>
		</Tooltip.Root>
	),
}

/** Multi-line text with large width constraint. */
export const MultiLineLg: Story = {
	args: { defaultOpen: true },
	render: (args: RootArgs) => (
		<Tooltip.Root {...args}>
			<Tooltip.Trigger render={<Button color="secondary">Hover me</Button>} />
			<Tooltip.Popup arrow size="lg">
				This is an even longer tooltip explanation that benefits from the lg size, giving it up to 500 px of width
				before it wraps. Useful for describing complex settings or actions.
			</Tooltip.Popup>
		</Tooltip.Root>
	),
}

/** Tooltip appearing below the trigger. */
export const Below: Story = {
	args: { defaultOpen: true },
	render: (args: RootArgs) => (
		<Tooltip.Root {...args}>
			<Tooltip.Trigger render={<Button color="secondary">Hover me</Button>} />
			<Tooltip.Popup arrow side="bottom">
				Appears below
			</Tooltip.Popup>
		</Tooltip.Root>
	),
}

/** Compact padding — useful for icon-only triggers. */
export const NoPadding: Story = {
	args: { defaultOpen: true },
	render: (args: RootArgs) => (
		<Tooltip.Root {...args}>
			<Tooltip.Trigger render={<Button color="secondary">Hover me</Button>} />
			<Tooltip.Popup arrow noPadding>
				Compact
			</Tooltip.Popup>
		</Tooltip.Root>
	),
}
