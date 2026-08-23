import {
	faArrowsLeftRight,
	faArrowsUpDown,
	faExpand,
	faLayerGroup,
	faLink,
	faMagnet,
	faObjectGroup,
	faPlay,
	faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { Meta, StoryObj } from '@storybook/react'
import { Toolbar } from './Toolbar'

const noop = () => {}

const meta = {
	component: Toolbar.Root,
	args: {
		orientation: 'horizontal',
		// The stories supply their own children through `render`; this only satisfies the required prop
		children: null,
	},
	render: (args) => (
		<Toolbar.Root {...args}>
			<Toolbar.Button title="Center horizontally" icon={faArrowsLeftRight} onClick={noop} />
			<Toolbar.Button title="Center vertically" icon={faArrowsUpDown} onClick={noop} />
			<Toolbar.Button title="Fill" icon={faExpand} onClick={noop} />
			<Toolbar.Separator />
			<Toolbar.Button title="Link" icon={faLink} active onClick={noop} />
			<Toolbar.Button title="Snap" icon={faMagnet} onClick={noop} />
			<Toolbar.Separator />
			<Toolbar.Button title="Bring to front" icon={faLayerGroup} onClick={noop} />
			<Toolbar.Button title="Send to back" icon={faObjectGroup} disabled onClick={noop} />
		</Toolbar.Root>
	),
} satisfies Meta<typeof Toolbar.Root>

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {}

export const Vertical: Story = {
	args: { orientation: 'vertical' },
}

/** The compact icon-only variant that sits alongside a canvas, as used by the quick actions rail. */
export const SmallVertical: Story = {
	args: { orientation: 'vertical', size: 'sm' },
}

/** Buttons kept together so a narrow toolbar wraps between groups rather than between arbitrary buttons. */
export const Groups: Story = {
	render: (args) => (
		<Toolbar.Root {...args}>
			<Toolbar.Group>
				<Toolbar.Button title="Center horizontally" icon={faArrowsLeftRight} onClick={noop} />
				<Toolbar.Button title="Center vertically" icon={faArrowsUpDown} onClick={noop} />
			</Toolbar.Group>
			<Toolbar.Separator />
			<Toolbar.Group>
				<Toolbar.Button title="Bring to front" icon={faLayerGroup} onClick={noop} />
				<Toolbar.Button title="Send to back" icon={faObjectGroup} onClick={noop} />
			</Toolbar.Group>
		</Toolbar.Root>
	),
}

/** A status filling the leftover space, kept on one row with the trailing buttons via the tail. */
export const WithStatus: Story = {
	render: (args) => (
		<Toolbar.Root {...args}>
			<Toolbar.Button title="Run" icon={faPlay} onClick={noop} />
			<Toolbar.Tail>
				<Toolbar.Status muted>Edit mode</Toolbar.Status>
				<Toolbar.Button title="Delete" icon={faTrash} tone="danger" onClick={noop} />
			</Toolbar.Tail>
		</Toolbar.Root>
	),
}

/** A live/irreversible state, so the bar itself carries the warning rather than a lone button. */
export const DangerStatus: Story = {
	render: (args) => (
		<Toolbar.Root {...args}>
			<Toolbar.Button title="Run" icon={faPlay} active tone="danger" onClick={noop} />
			<Toolbar.Tail>
				<Toolbar.Status tone="danger">
					<FontAwesomeIcon icon={faPlay} />
					<span>Press mode is live</span>
				</Toolbar.Status>
			</Toolbar.Tail>
		</Toolbar.Root>
	),
}

/** A disabled button whose tooltip explains why, as when there is no editable selection. */
export const DisabledWithReason: Story = {
	render: (args) => (
		<Toolbar.Root {...args}>
			<Toolbar.Button
				title="Center horizontally"
				icon={faArrowsLeftRight}
				disabled
				disabledReason="Select an element with plain bounds first"
				onClick={noop}
			/>
			<Toolbar.Button title="Snap" icon={faMagnet} active onClick={noop} />
		</Toolbar.Root>
	),
}
