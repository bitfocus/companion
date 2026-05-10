import type { Decorator, Meta, StoryObj } from '@storybook/react'
import { mockRootAppStore, withMockStore } from '../../.storybook/mockRootAppStore'
import { RootAppStoreContext, type RootAppStore } from '../Stores/RootAppStore'
import { LearnButton } from './LearnButton'

const meta = {
	component: LearnButton,
	decorators: [withMockStore],
	args: {
		id: 'my-learn-id',
		doLearn: () => console.log('learn triggered'),
	},
} satisfies Meta<typeof LearnButton>

export default meta
type Story = StoryObj<typeof meta>

export const Idle: Story = {}

const withActiveLearnDecorator: Decorator = (Story) => (
	<RootAppStoreContext.Provider value={{ ...mockRootAppStore, activeLearns: new Set(['my-learn-id']) } as RootAppStore}>
		<Story />
	</RootAppStoreContext.Provider>
)

export const Active: Story = {
	decorators: [withActiveLearnDecorator],
}

export const Disabled: Story = {
	args: { disabled: true },
}
