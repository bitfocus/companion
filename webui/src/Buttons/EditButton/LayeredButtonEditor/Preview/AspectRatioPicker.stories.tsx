import type { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { Popover } from '~/Components/Popover.js'
import { CustomAspectRatioBody } from './AspectRatioPicker'

const meta = {
	component: CustomAspectRatioBody,
	args: {
		value: '9:7',
		// Replaced by the render below, which feeds changes back into the story args
		setValue: () => {},
		surfaceChoices: [],
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ value: string }>()
		return (
			<Popover.Root open>
				<Popover.Trigger className="button-layer-aspect-option">edit</Popover.Trigger>
				<Popover.Popup className="button-layer-aspect-custom" align="end">
					<CustomAspectRatioBody {...args} setValue={(value) => setArgs({ value })} />
				</Popover.Popup>
			</Popover.Root>
		)
	},
} satisfies Meta<typeof CustomAspectRatioBody>

export default meta
type Story = StoryObj<typeof meta>

/** No surface has a shape the preset buttons don't already cover, so only the fields show */
export const NoSurfaceShapes: Story = {}

/** A Stream Deck Neo is connected, so its info bar shape is offered */
export const OneSurfaceShape: Story = {
	args: {
		surfaceChoices: [{ id: '124:29', label: '124:29 (Stream Deck Neo)' }],
	},
}

/** Several surfaces with unusual shapes, one of them currently applied */
export const ManySurfaceShapes: Story = {
	args: {
		value: '124:29',
		surfaceChoices: [
			{ id: '124:29', label: '124:29 (Stream Deck Neo)' },
			{ id: '3:2', label: '3:2 (Loupedeck Live)' },
			{ id: '5:3', label: '5:3 (Some Very Long Surface Name)' },
		],
	},
}
