import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { HorizontalAlignmentInputField, VerticalAlignmentInputField } from './AlignmentInputField'

const meta = {
	component: HorizontalAlignmentInputField,
	args: {
		id: undefined,
		value: 'center',
		setValue: () => {},
	},
} satisfies Meta<typeof HorizontalAlignmentInputField>

export default meta
type Story = StoryObj<typeof meta>

export const HorizontalAlignment: Story = {
	render: function Render() {
		const [value, setValue] = useState('center')
		return <HorizontalAlignmentInputField id={undefined} value={value} setValue={setValue} />
	},
}

export const HorizontalAlignmentDisabled: Story = {
	render: function Render() {
		const [value, setValue] = useState('center')
		return <HorizontalAlignmentInputField id={undefined} value={value} setValue={setValue} disabled />
	},
}

export const VerticalAlignment: Story = {
	render: function Render() {
		const [value, setValue] = useState('center')
		return <VerticalAlignmentInputField id={undefined} value={value} setValue={setValue} />
	},
}

export const VerticalAlignmentDisabled: Story = {
	render: function Render() {
		const [value, setValue] = useState('center')
		return <VerticalAlignmentInputField id={undefined} value={value} setValue={setValue} disabled />
	},
}
