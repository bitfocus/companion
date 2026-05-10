import type { Decorator, Meta, StoryObj } from '@storybook/react'
import { ButtonPreviewBase, RedImage } from './ButtonPreview'

const withSize: Decorator = (Story) => (
	<div style={{ width: 72, height: 72 }}>
		<Story />
	</div>
)

const meta = {
	component: ButtonPreviewBase,
	decorators: [withSize],
	args: {
		preview: null,
		style: { width: '100%', height: '100%' },
		canDrop: false,
		dropHover: false,
		right: false,
		title: '',
	},
} satisfies Meta<typeof ButtonPreviewBase>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const WithPlaceholder: Story = {
	args: { placeholder: '1/2', preview: null },
}

export const WithImage: Story = {
	args: { preview: RedImage },
}

export const Selected: Story = {
	args: { preview: RedImage, selected: true },
}

export const Clickable: Story = {
	args: {
		preview: RedImage,
		onClick: (pressed) => console.log('clicked', pressed),
	},
}

export const FixedSize: Story = {
	args: { preview: RedImage, fixedSize: true },
}

/** canDrop highlights the button as a valid drop target */
export const CanDrop: Story = {
	args: { preview: RedImage, canDrop: true },
}

/** dropHover shows the button is being hovered while dragging */
export const DropHover: Story = {
	args: { preview: RedImage, canDrop: true, dropHover: true },
}

/** right-aligned layout variant */
export const RightLayout: Story = {
	args: { preview: RedImage, right: true },
}

export const WithTitle: Story = {
	args: { preview: RedImage, title: 'My Button' },
}
