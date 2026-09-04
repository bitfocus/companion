import type { Meta, StoryObj } from '@storybook/react'
import { VariableTypeIcon, type VariableTypeIconType } from './VariableTypeIcon'

const meta = {
	component: VariableTypeIcon,
	args: {
		width: 32,
		height: 32,
		fill: '#333',
	},
} satisfies Meta<typeof VariableTypeIcon>

export default meta
type Story = StoryObj<typeof meta>

export const StringType: Story = { args: { icon: 'string' } }
export const NumberType: Story = { args: { icon: 'number' } }
export const BooleanType: Story = { args: { icon: 'boolean' } }
export const ObjectType: Story = { args: { icon: 'object' } }
export const NullType: Story = { args: { icon: 'null' } }
export const UndefinedType: Story = { args: { icon: 'undefined' } }
export const UnknownType: Story = { args: { icon: 'unknown' } }

const allIcons: VariableTypeIconType[] = [
	'string',
	'number',
	'boolean',
	'object',
	'undefined',
	'null',
	'NaN',
	'regex',
	'asterisk',
	'A',
	'$',
	'unknown',
]

export const AllTypes: Story = {
	render: (args) => (
		<div className="flex flex-wrap gap-3 items-center">
			{allIcons.map((icon) => (
				<div key={icon} className="flex flex-col items-center gap-1">
					<VariableTypeIcon {...args} icon={icon} />
					<span style={{ fontSize: 11, color: '#555' }}>{icon}</span>
				</div>
			))}
		</div>
	),
}
