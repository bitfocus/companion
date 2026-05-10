import type { Meta, StoryObj } from '@storybook/react'
import { TabArea } from './TabArea'

const meta = {
	component: TabArea.Root,
	render: (args) => (
		<TabArea.Root {...args}>
			<TabArea.List>
				<TabArea.Tab value="tab1">First</TabArea.Tab>
				<TabArea.Tab value="tab2">Second</TabArea.Tab>
				<TabArea.Tab value="tab3">Third</TabArea.Tab>
				<TabArea.Indicator />
			</TabArea.List>
			<TabArea.Panel value="tab1">Content of the first tab</TabArea.Panel>
			<TabArea.Panel value="tab2">Content of the second tab</TabArea.Panel>
			<TabArea.Panel value="tab3">Content of the third tab</TabArea.Panel>
		</TabArea.Root>
	),
} satisfies Meta<typeof TabArea.Root>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		defaultValue: 'tab1',
	},
}

export const SecondTabActive: Story = {
	args: {
		defaultValue: 'tab2',
	},
}
