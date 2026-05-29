import type { Meta, StoryObj } from '@storybook/react'
import { Spinner } from './Spinner'

const meta = {
	component: Spinner,
	args: {
		color: 'warning',
		style: { width: '29px', height: '29px' },
	},
	decorators: [
		(Story) => (
			<div style={{ padding: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Spinner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Warning: Story = {
	args: {
		color: 'warning',
	},
}

export const Danger: Story = {
	args: {
		color: 'danger',
	},
}

export const CustomHex: Story = {
	args: {
		color: '#35a76a',
	},
}

export const Multiple: Story = {
	render: () => (
		<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
			<Spinner color="warning" style={{ width: '24px', height: '24px' }} />
			<Spinner color="danger" style={{ width: '24px', height: '24px' }} />
			<Spinner color="success" style={{ width: '24px', height: '24px' }} />
			<Spinner color="#4d8bf5" style={{ width: '24px', height: '24px' }} />
		</div>
	),
}
