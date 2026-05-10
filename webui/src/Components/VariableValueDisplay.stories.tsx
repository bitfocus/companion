import type { Meta, StoryObj } from '@storybook/react'
import { VariableValueDisplay } from './VariableValueDisplay'

// All toggleable props are exposed as controls — use the Controls panel to
// interactively toggle showIcon, showCopy, compact, forceExpanded, maxLines, icon.
const meta = {
	component: VariableValueDisplay,
	args: {
		value: 'Hello, World!',
		onCopied: () => {},
		showIcon: true,
		showCopy: true,
		compact: false,
		forceExpanded: false,
	},
} satisfies Meta<typeof VariableValueDisplay>

export default meta
type Story = StoryObj<typeof meta>

/** String value — all props tweakable via the Controls panel */
export const Default: Story = {}

/** Multi-line value — shows the collapse/expand affordance */
export const Multiline: Story = {
	args: {
		value: 'Line one\nLine two\nLine three\nLine four\nLine five\nLine six',
	},
}

/** Numeric value — shows the number type icon */
export const NumberValue: Story = {
	args: { value: 42 },
}

/** JSON object value — shows the object type icon and JSON formatting */
export const ObjectValue: Story = {
	args: { value: { name: 'Companion', version: 3, active: true } },
}

/** Error state — shown when a variable cannot be resolved */
export const Invalid: Story = {
	args: { value: undefined, invalidReason: 'Variable not found' },
}
