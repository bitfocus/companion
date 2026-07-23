import type { Decorator, Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import type { JsonValue } from 'type-fest'
import type { InternalInputFieldTable } from '@companion-app/shared/Model/Options.js'
import { MenuPortalContext } from './MenuPortalContext.js'
import { TableInputField } from './TableInputField.js'

const withPortal: Decorator = (Story) => (
	<MenuPortalContext.Provider value={document.body}>
		<Story />
	</MenuPortalContext.Provider>
)

const gaugeThresholdDefinition: InternalInputFieldTable = {
	id: 'thresholds',
	type: 'internal:table',
	label: 'Color thresholds',
	columns: [
		{ id: 'value', type: 'number', label: 'Value', min: 0, max: 100, step: 1, default: 0 },
		{ id: 'color', type: 'colorpicker', label: 'Color', default: 0x00ff00, enableAlpha: false, returnType: 'number' },
	],
	default: [
		{ value: 0, color: 0x00ff00 },
		{ value: 66, color: 0xffff00 },
		{ value: 85, color: 0xff0000 },
	],
}

function StatefulTable({
	definition,
	initialValue,
	disabled,
}: {
	definition: InternalInputFieldTable
	initialValue: Record<string, JsonValue>[]
	disabled?: boolean
}): React.JSX.Element {
	const [value, setValue] = useState(initialValue)
	return (
		<div style={{ padding: 16, maxWidth: 400 }}>
			<TableInputField
				definition={definition}
				value={value}
				setValue={setValue}
				disabled={disabled}
				localVariablesStore={null}
				entityType={null}
				isLocatedInGrid={false}
			/>
			<pre style={{ marginTop: 16, fontSize: 11 }}>{JSON.stringify(value, null, 2)}</pre>
		</div>
	)
}

const meta = {
	title: 'Components/TableInputField',
	decorators: [withPortal],
	render: (args) => <StatefulTable {...args} />,
} satisfies Meta<typeof StatefulTable>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		definition: gaugeThresholdDefinition,
		initialValue: [
			{ value: 0, color: 0x00ff00 },
			{ value: 66, color: 0xffff00 },
			{ value: 85, color: 0xff0000 },
		],
	},
}

export const Empty: Story = {
	args: {
		definition: gaugeThresholdDefinition,
		initialValue: [],
	},
}

export const Disabled: Story = {
	args: {
		definition: gaugeThresholdDefinition,
		initialValue: [
			{ value: 0, color: 0x00ff00 },
			{ value: 66, color: 0xffff00 },
		],
		disabled: true,
	},
}

export const TextColumn: Story = {
	args: {
		definition: {
			id: 'labels',
			type: 'internal:table',
			label: 'Labels',
			columns: [
				{ id: 'value', type: 'number', label: 'Position', min: 0, max: 100, step: 1, default: 0 },
				{ id: 'label', type: 'textinput', label: 'Text', default: '' },
			],
			default: [],
		} satisfies InternalInputFieldTable,
		initialValue: [
			{ value: 0, label: 'Low' },
			{ value: 50, label: 'Mid' },
			{ value: 100, label: 'High' },
		],
	},
}

export const SingleColumn: Story = {
	args: {
		definition: {
			id: 'values',
			type: 'internal:table',
			label: 'Values',
			columns: [{ id: 'value', type: 'number', label: 'Value', min: 0, max: 100, step: 1, default: 50 }],
			default: [],
		} satisfies InternalInputFieldTable,
		initialValue: [{ value: 25 }, { value: 75 }],
	},
}
