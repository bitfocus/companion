import type { Decorator, Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { ColorInputField } from './ColorInputField'
import { MenuPortalContext } from './MenuPortalContext'

const withPortal: Decorator = (Story) => (
	<MenuPortalContext.Provider value={document.body}>
		<Story />
	</MenuPortalContext.Provider>
)

const meta = {
	component: ColorInputField<'number'>,
	decorators: [withPortal],
	args: {
		value: 0x000000,
		returnType: 'number',
		setValue: () => {},
		enableAlpha: false,
		disabled: false,
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ value: number }>()
		return <ColorInputField<'number'> {...args} setValue={(v) => setArgs({ value: v })} />
	},
} satisfies Meta<typeof ColorInputField<'number'>>

export default meta
type Story = StoryObj<typeof meta>

export const Black: Story = {}

export const Red: Story = {
	args: { value: 0xff0000 },
}

export const WithAlpha: Story = {
	args: { value: 0x800000ff, enableAlpha: true },
}

export const WithPresetColors: Story = {
	args: {
		presetColors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'],
	},
}
