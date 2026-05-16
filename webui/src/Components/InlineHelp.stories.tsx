import type { Meta, StoryObj } from '@storybook/react'
import { InlineHelpCustom, InlineHelpIcon } from './InlineHelp'

const meta = {
	component: InlineHelpIcon,
} satisfies Meta<typeof InlineHelpIcon>

export default meta
type Story = StoryObj<typeof meta>

export const Icon: Story = {
	args: {
		children: 'This is the help text shown in a popover when you hover the question mark icon.',
	},
}

export const Custom: Story = {
	args: { children: '' },
	render: () => (
		<InlineHelpCustom help="This help text appears when you hover the custom trigger element.">
			<span style={{ textDecoration: 'underline dotted', cursor: 'help' }}>hover me</span>
		</InlineHelpCustom>
	),
}

export const RichContent: Story = {
	args: { children: '' },
	render: () => (
		<InlineHelpIcon>
			<div>
				<strong>Rich help content</strong>
				<ul>
					<li>First item</li>
					<li>Second item</li>
				</ul>
			</div>
		</InlineHelpIcon>
	),
}
