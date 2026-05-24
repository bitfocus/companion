import { faCopy, faEllipsisVertical, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { Meta, StoryObj } from '@storybook/react'
import type { ComponentProps } from 'react'
import { Popover } from './Popover'

type RootArgs = ComponentProps<typeof Popover.Root>

const meta = {
	component: Popover.Root,
	decorators: [
		(Story) => (
			<div style={{ padding: 80, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
				<Story />
			</div>
		),
	],
	render: (args: RootArgs) => (
		<Popover.Root {...args}>
			<Popover.Trigger color="secondary">Options</Popover.Trigger>
			<Popover.Popup>
				<Popover.Item onClick={() => console.log('copy')}>Copy</Popover.Item>
				<Popover.Item onClick={() => console.log('delete')}>Delete</Popover.Item>
			</Popover.Popup>
		</Popover.Root>
	),
} satisfies Meta<typeof Popover.Root>

export default meta
type Story = StoryObj<typeof meta>

/** Default closed state — click to open. */
export const Default: Story = {}

/** Popup open immediately so it's visible in the canvas. */
export const OpenByDefault: Story = {
	args: { defaultOpen: true },
}

/** Items with icons. */
export const WithIcons: Story = {
	args: { defaultOpen: true },
	render: (args: RootArgs) => (
		<Popover.Root {...args}>
			<Popover.Trigger color="secondary">
				<FontAwesomeIcon icon={faEllipsisVertical} />
			</Popover.Trigger>
			<Popover.Popup>
				<Popover.Item onClick={() => console.log('copy')}>
					<FontAwesomeIcon icon={faCopy} fixedWidth /> Copy
				</Popover.Item>
				<Popover.Item onClick={() => console.log('delete')}>
					<FontAwesomeIcon icon={faTrash} fixedWidth /> Delete
				</Popover.Item>
			</Popover.Popup>
		</Popover.Root>
	),
}

/** Arrow pointing from popup to trigger. */
export const WithArrow: Story = {
	args: { defaultOpen: true },
	render: (args: RootArgs) => (
		<Popover.Root {...args}>
			<Popover.Trigger color="primary">
				<FontAwesomeIcon icon={faPlus} /> Add element
			</Popover.Trigger>
			<Popover.Popup arrow align="center">
				<Popover.Item onClick={() => console.log('text')}>Text</Popover.Item>
				<Popover.Item onClick={() => console.log('image')}>Image</Popover.Item>
				<Popover.Item onClick={() => console.log('button')}>Button</Popover.Item>
			</Popover.Popup>
		</Popover.Root>
	),
}

/** Arrow on top side (popup opens upward). */
export const WithArrowTop: Story = {
	args: { defaultOpen: true },
	decorators: [
		(Story: () => JSX.Element): JSX.Element => (
			<div style={{ padding: 80, paddingTop: 160, display: 'flex', justifyContent: 'center' }}>
				<Story />
			</div>
		),
	],
	render: (args: RootArgs) => (
		<Popover.Root {...args}>
			<Popover.Trigger color="primary">Open upward</Popover.Trigger>
			<Popover.Popup arrow side="top" align="center">
				<Popover.Item onClick={() => console.log('item 1')}>Item 1</Popover.Item>
				<Popover.Item onClick={() => console.log('item 2')}>Item 2</Popover.Item>
			</Popover.Popup>
		</Popover.Root>
	),
}

/** Popup opens to the right of the trigger. */
export const SideRight: Story = {
	args: { defaultOpen: true },
	decorators: [
		(Story: () => JSX.Element): JSX.Element => (
			<div style={{ padding: 80, display: 'flex', justifyContent: 'flex-start' }}>
				<Story />
			</div>
		),
	],
	render: (args: RootArgs) => (
		<Popover.Root {...args}>
			<Popover.Trigger color="secondary">
				<FontAwesomeIcon icon={faEllipsisVertical} />
			</Popover.Trigger>
			<Popover.Popup side="right" align="center">
				<Popover.Item onClick={() => console.log('copy')}>Copy</Popover.Item>
				<Popover.Item onClick={() => console.log('delete')}>Delete</Popover.Item>
			</Popover.Popup>
		</Popover.Root>
	),
}

/** One item is disabled — it cannot be clicked and does not close the popup. */
export const WithDisabledItem: Story = {
	args: { defaultOpen: true },
	render: (args: RootArgs) => (
		<Popover.Root {...args}>
			<Popover.Trigger color="secondary">Options</Popover.Trigger>
			<Popover.Popup>
				<Popover.Item onClick={() => console.log('copy')}>Copy</Popover.Item>
				<Popover.Item disabled onClick={() => console.log('unavailable')}>
					Unavailable action
				</Popover.Item>
				<Popover.Item onClick={() => console.log('delete')}>Delete</Popover.Item>
			</Popover.Popup>
		</Popover.Root>
	),
}

/** Small trigger button — e.g. icon-only in a tight layout. */
export const SmallTrigger: Story = {
	args: { defaultOpen: true },
	render: (args: RootArgs) => (
		<Popover.Root {...args}>
			<Popover.Trigger color="secondary" size="sm">
				<FontAwesomeIcon icon={faPlus} />
			</Popover.Trigger>
			<Popover.Popup>
				<Popover.Item onClick={() => console.log('item 1')}>Item 1</Popover.Item>
				<Popover.Item onClick={() => console.log('item 2')}>Item 2</Popover.Item>
			</Popover.Popup>
		</Popover.Root>
	),
}

/** Danger-coloured trigger. */
export const DangerTrigger: Story = {
	args: { defaultOpen: true },
	render: (args: RootArgs) => (
		<Popover.Root {...args}>
			<Popover.Trigger color="danger">Danger</Popover.Trigger>
			<Popover.Popup>
				<Popover.Item onClick={() => console.log('confirm')}>Confirm delete</Popover.Item>
				<Popover.Item onClick={() => console.log('cancel')}>Cancel</Popover.Item>
			</Popover.Popup>
		</Popover.Root>
	),
}

/** Caret-only split-button pattern: separate action button + caret trigger. */
export const SplitButton: Story = {
	args: { defaultOpen: true },
	render: (args: RootArgs) => (
		<div className="btn-group">
			<button className="btn button button-primary" onClick={() => console.log('primary action')}>
				Save
			</button>
			<Popover.Root {...args}>
				<Popover.Trigger color="primary" caret aria-label="More save options" />
				<Popover.Popup>
					<Popover.Item onClick={() => console.log('save copy')}>Save a copy</Popover.Item>
					<Popover.Item onClick={() => console.log('save as')}>Save as…</Popover.Item>
				</Popover.Popup>
			</Popover.Root>
		</div>
	),
}

/** Controlled open state — always open, no external toggle. */
export const ControlledOpen: Story = {
	args: { open: true },
	render: (args: RootArgs) => (
		<Popover.Root {...args}>
			<Popover.Trigger color="secondary">Trigger (controlled)</Popover.Trigger>
			<Popover.Popup>
				<Popover.Item onClick={() => console.log('item')}>Item</Popover.Item>
			</Popover.Popup>
		</Popover.Root>
	),
}
