import type { Meta, StoryObj } from '@storybook/react'
import { Grid } from '~/Components/Grid'
import { LoadingRetryOrError } from './Loading'

const meta = {
	component: LoadingRetryOrError,
	decorators: [
		(Story) => (
			<Grid.Container style={{ maxWidth: 640, padding: 24 }}>
				<Grid.Row>
					<Story />
				</Grid.Row>
			</Grid.Container>
		),
	],
	args: {
		dataReady: false,
		design: 'pulse',
		doRetry: () => console.log('retry'),
	},
} satisfies Meta<typeof LoadingRetryOrError>

export default meta
type Story = StoryObj<typeof meta>

export const LoadingPulse: Story = {
	args: { design: 'pulse', error: null },
}

export const LoadingBar: Story = {
	args: { design: 'bar', error: null },
}

export const LoadingPulseXl: Story = {
	args: { design: 'pulse-xl', error: null },
}

export const Error: Story = {
	args: { error: 'Something went wrong while loading' },
}

export const ErrorWithCountdown: Story = {
	args: { error: 'Connection failed', retryLabel: 'Reload', autoRetryAfter: 10 },
}

export const ErrorNoRetry: Story = {
	args: { error: 'Not found', doRetry: undefined },
}
