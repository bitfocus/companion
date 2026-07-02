import type { Meta, StoryObj } from '@storybook/react'
import { StandalonePageError } from './StandalonePageError'

const meta = {
	component: StandalonePageError,
	parameters: {
		layout: 'fullscreen',
	},
	decorators: [
		(Story) => (
			<div style={{ height: '100vh', width: '100%', background: '#181818' }}>
				<Story />
			</div>
		),
	],
	args: {
		dataReady: false,
		doRetry: () => console.log('retry'),
	},
} satisfies Meta<typeof StandalonePageError>

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
	args: {
		error: null,
	},
}

export const Error: Story = {
	args: {
		error: 'Failed to load emulator configuration',
	},
}

export const ErrorWithCountdown: Story = {
	args: {
		error: 'Failed to load emulator configuration',
		autoRetryAfter: 10,
	},
}

export const ErrorCustomCopy: Story = {
	args: {
		error: 'not found',
		title: 'Emulator not found',
		message: 'This surface may have been removed.',
	},
}

export const ErrorNoRetry: Story = {
	args: {
		error: 'This surface is no longer available',
		doRetry: undefined,
	},
}
