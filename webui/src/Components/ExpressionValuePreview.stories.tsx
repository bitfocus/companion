import type { Meta, StoryObj } from '@storybook/react'
import { exprVal, type SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { ExpressionPreviewResult, ExpressionValuePreview } from './ExpressionValuePreview'

// ---------------------------------------------------------------------------
// Shared field definitions
// ---------------------------------------------------------------------------

const textField: SomeCompanionInputField = {
	type: 'textinput',
	id: 'value',
	label: 'Value',
	default: '',
}

const numberField: SomeCompanionInputField = {
	type: 'number',
	id: 'value',
	label: 'Value',
	default: 0,
	min: 0,
	max: 100,
}

// ---------------------------------------------------------------------------
// ExpressionPreviewResult — all result display states, no subscription needed
// ---------------------------------------------------------------------------

const resultMeta = {
	component: ExpressionPreviewResult,
	parameters: { layout: 'padded' },
	args: { fieldDefinition: textField },
} satisfies Meta<typeof ExpressionPreviewResult>

export default resultMeta
type ResultStory = StoryObj<typeof resultMeta>

export const StringValue: ResultStory = {
	args: { data: { ok: true, value: 'hello world' } },
}

export const NumericValue: ResultStory = {
	args: { data: { ok: true, value: 42 } },
}

export const BooleanValue: ResultStory = {
	args: { data: { ok: true, value: true } },
}

export const NullValue: ResultStory = {
	name: 'Null value',
	args: { data: { ok: true, value: null } },
}

export const UndefinedValue: ResultStory = {
	name: 'Undefined value',
	args: { data: { ok: true, value: undefined } },
}

export const ErrorResult: ResultStory = {
	args: { data: { ok: false, error: 'Variable "bad:var" not found' } },
}

export const ValidationError: ResultStory = {
	name: 'Out of range (validation error)',
	args: {
		data: { ok: true, value: 999 },
		fieldDefinition: numberField,
	},
}

export const ValidNumber: ResultStory = {
	args: {
		data: { ok: true, value: 50 },
		fieldDefinition: numberField,
	},
}

// ---------------------------------------------------------------------------
// ExpressionValuePreview — outer shell states (no live subscription needed)
// ---------------------------------------------------------------------------

export const InvalidExpression: StoryObj = {
	render: () => <ExpressionValuePreview expression="1 + + +" controlId={null} fieldDefinition={textField} />,
}

export const EmptyExpression: StoryObj = {
	name: 'Empty expression (renders nothing)',
	render: () => (
		<div style={{ border: '1px dashed #ccc', padding: 8, color: '#999', fontSize: 12 }}>
			ExpressionValuePreview with empty string renders null — nothing shown below
			<ExpressionValuePreview expression="" controlId={null} fieldDefinition={textField} />
		</div>
	),
}

export const WithContextResolution: StoryObj = {
	name: 'With customVariable context (subscription-dependent)',
	render: () => (
		<div>
			<p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
				This story requires a live server subscription. In isolation the component renders nothing until the server
				responds. See Vitest tests for full coverage of subscription states.
			</p>
			<ExpressionValuePreview
				expression="$(this:current) * 2"
				controlId={null}
				fieldDefinition={textField}
				contextResolution={{ type: 'customVariable', nameValue: exprVal('myCounter') }}
			/>
		</div>
	),
}
