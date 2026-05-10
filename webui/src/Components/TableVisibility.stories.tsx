import type { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import { VisibilityButton } from './TableVisibility'

type Columns = { name: boolean; status: boolean; actions: boolean }

const defaultVisibility: Columns = { name: true, status: true, actions: false }

const meta = {
	component: VisibilityButton<Columns>,
	args: {
		keyId: 'name',
		color: 'primary',
		label: 'Name',
		visibility: defaultVisibility,
		toggleVisibility: () => {},
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ visibility: Columns }>()
		const toggleVisibility = (key: keyof Columns) => {
			const next = { ...args.visibility, [key]: !args.visibility[key] }
			setArgs({ visibility: next })
		}
		return <VisibilityButton {...args} toggleVisibility={toggleVisibility} />
	},
} satisfies Meta<typeof VisibilityButton<Columns>>

export default meta
type Story = StoryObj<typeof meta>

export const ActiveByDefault: Story = {}

export const InactiveByDefault: Story = {
	args: {
		keyId: 'actions',
		label: 'Actions',
	},
}

export const MultipleButtons: Story = {
	render: function Render(args) {
		const [, setArgs] = useArgs<{ visibility: Columns }>()
		const toggleVisibility = (key: keyof Columns) => {
			const next = { ...args.visibility, [key]: !args.visibility[key] }
			setArgs({ visibility: next })
		}
		return (
			<div style={{ display: 'flex', gap: '4px' }}>
				<VisibilityButton {...args} keyId="name" label="Name" color="primary" toggleVisibility={toggleVisibility} />
				<VisibilityButton {...args} keyId="status" label="Status" color="success" toggleVisibility={toggleVisibility} />
				<VisibilityButton
					{...args}
					keyId="actions"
					label="Actions"
					color="warning"
					toggleVisibility={toggleVisibility}
				/>
			</div>
		)
	},
}

const allColors = ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'] as const

export const AllColors: Story = {
	render: function Render(args) {
		const [, setArgs] = useArgs<{ visibility: Columns }>()
		const toggleVisibility = (key: keyof Columns) => {
			const next = { ...args.visibility, [key]: !args.visibility[key] }
			setArgs({ visibility: next })
		}
		return (
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
				{allColors.map((color) => (
					<VisibilityButton
						key={color}
						{...args}
						keyId="name"
						label={color}
						color={color}
						toggleVisibility={toggleVisibility}
					/>
				))}
			</div>
		)
	},
}
