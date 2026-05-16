import type { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { SearchBox } from './SearchBox'

const meta = {
	component: SearchBox,
	args: {
		filter: '',
		setFilter: () => {},
	},
	render: function Render(args) {
		const [, setArgs] = useArgs()
		return <SearchBox {...args} setFilter={(value) => setArgs({ filter: value })} />
	},
} satisfies Meta<typeof SearchBox>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
	args: {
		filter: '',
	},
}

export const WithValue: Story = {
	args: {
		filter: 'my search',
	},
}
