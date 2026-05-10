import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { useArgs } from 'storybook/preview-api'
import type { CompanionAlignment } from '@companion-module/base'
import { AlignmentInputField, HorizontalAlignmentInputField, VerticalAlignmentInputField } from './AlignmentInputField'

const meta = {
	component: AlignmentInputField,
	args: {
		value: 'center:center' as CompanionAlignment,
		setValue: () => {},
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ value: CompanionAlignment }>()
		return <AlignmentInputField {...args} setValue={(v) => setArgs({ value: v })} />
	},
} satisfies Meta<typeof AlignmentInputField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const TopLeft: Story = { args: { value: 'left:top' as CompanionAlignment } }
export const BottomRight: Story = { args: { value: 'right:bottom' as CompanionAlignment } }

export const HorizontalAlignment: Story = {
	render: function Render() {
		const [value, setValue] = useState('center')
		return <HorizontalAlignmentInputField value={value} setValue={setValue} />
	},
}

export const HorizontalAlignmentDisabled: Story = {
	render: function Render() {
		const [value, setValue] = useState('center')
		return <HorizontalAlignmentInputField value={value} setValue={setValue} disabled />
	},
}

export const VerticalAlignment: Story = {
	render: function Render() {
		const [value, setValue] = useState('center')
		return <VerticalAlignmentInputField value={value} setValue={setValue} />
	},
}

export const VerticalAlignmentDisabled: Story = {
	render: function Render() {
		const [value, setValue] = useState('center')
		return <VerticalAlignmentInputField value={value} setValue={setValue} disabled />
	},
}
