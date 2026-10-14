import { faCopy } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'
import { DuplicateIcon } from './DuplicateIcon'

const meta = {
	component: DuplicateIcon,
	decorators: [
		(Story) => (
			<div style={{ padding: 24, background: 'var(--color-surface)' }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof DuplicateIcon>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Next to the copy-to-clipboard icon it is kept distinct from. */
export const BesideCopy: Story = {
	render: () => (
		<div className="flex gap-1">
			<Button variant="icon" size="sm" title="Duplicate">
				<DuplicateIcon />
			</Button>
			<Button variant="icon" size="sm" title="Copy">
				<FontAwesomeIcon icon={faCopy} />
			</Button>
		</div>
	),
}
