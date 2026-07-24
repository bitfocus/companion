import type { Decorator, Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import type { JsonValue } from 'type-fest'
import type { ExpressionOrValue, InternalInputFieldList } from '@companion-app/shared/Model/Options.js'
import { withMockStore } from '../../.storybook/mockRootAppStore.js'
import { ListInputField } from './ListInputField.js'
import { MenuPortalContext } from './MenuPortalContext.js'

const withPortal: Decorator = (Story) => (
	<MenuPortalContext.Provider value={document.body}>
		<div className="row g-2" style={{ padding: 16, maxWidth: 600 }}>
			<Story />
		</div>
	</MenuPortalContext.Provider>
)

const gaugeThresholdDefinition: InternalInputFieldList = {
	id: 'thresholds',
	type: 'internal:list',
	label: 'Color thresholds',
	tooltip: 'Define color stops for the gauge.',
	addLabel: 'Add threshold',
	fields: [
		{ id: 'value', type: 'number', label: 'Value', min: 0, max: 100, step: 1, default: 0 },
		{ id: 'color', type: 'colorpicker', label: 'Color', default: 0x00ff00, enableAlpha: false, returnType: 'number' },
	],
	default: [
		{ value: 0, color: 0x00ff00 },
		{ value: 66, color: 0xffff00 },
		{ value: 85, color: 0xff0000 },
	],
}

function exprVal<T extends JsonValue>(v: T): ExpressionOrValue<T> {
	return { isExpression: false, value: v }
}

function StatefulList({
	definition,
	initialValue,
	disabled,
	fieldSupportsExpression,
}: {
	definition: InternalInputFieldList
	initialValue: Record<string, ExpressionOrValue<JsonValue>>[]
	disabled?: boolean
	fieldSupportsExpression?: boolean
}): React.JSX.Element {
	const [value, setValue] = useState(initialValue)
	return (
		<>
			<ListInputField
				definition={definition}
				value={value}
				setValue={setValue}
				disabled={disabled}
				localVariablesStore={null}
				entityType={null}
				isLocatedInGrid={false}
				fieldSupportsExpression={fieldSupportsExpression ?? false}
			/>
			<div className="col-12">
				<pre style={{ marginTop: 8, fontSize: 11 }}>{JSON.stringify(value, null, 2)}</pre>
			</div>
		</>
	)
}

const meta = {
	title: 'Components/ListInputField',
	decorators: [withMockStore, withPortal],
	render: (args) => <StatefulList {...args} />,
} satisfies Meta<typeof StatefulList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		definition: gaugeThresholdDefinition,
		initialValue: [
			{ value: exprVal(0), color: exprVal(0x00ff00) },
			{ value: exprVal(66), color: exprVal(0xffff00) },
			{ value: exprVal(85), color: exprVal(0xff0000) },
		],
	},
}

export const WithExpressions: Story = {
	args: {
		definition: gaugeThresholdDefinition,
		initialValue: [
			{ value: exprVal(0), color: exprVal(0x00ff00) },
			{ value: { isExpression: true, value: '$(internal:custom_var)' }, color: exprVal(0xffff00) },
		],
		fieldSupportsExpression: true,
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
			{ value: exprVal(0), color: exprVal(0x00ff00) },
			{ value: exprVal(66), color: exprVal(0xffff00) },
		],
		disabled: true,
	},
}

export const TextColumn: Story = {
	args: {
		definition: {
			id: 'labels',
			type: 'internal:list',
			label: 'Labels',
			addLabel: 'Add label',
			fields: [
				{ id: 'value', type: 'number', label: 'Position', min: 0, max: 100, step: 1, default: 0 },
				{ id: 'label', type: 'textinput', label: 'Text', default: '' },
			],
			default: [],
		} satisfies InternalInputFieldList,
		initialValue: [
			{ value: exprVal(0), label: exprVal('Low') },
			{ value: exprVal(50), label: exprVal('Mid') },
			{ value: exprVal(100), label: exprVal('High') },
		],
		fieldSupportsExpression: true,
	},
}
