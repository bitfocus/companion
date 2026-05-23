import type { Decorator, Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'
import { useArgs } from 'storybook/preview-api'
import { withMockStore } from '../../.storybook/mockRootAppStore'
import { MenuPortalContext } from './MenuPortalContext'
import { TextInputField } from './TextInputField2'

type TextInputFieldProps = React.ComponentProps<typeof TextInputField>

/** Wraps TextInputField with a small event log panel below it. */
function WithEventLog(props: TextInputFieldProps): React.JSX.Element {
	const [log, setLog] = useState<string[]>([])
	const [value, setValue] = useState(props.value)

	function addLog(msg: string) {
		setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20))
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
			<TextInputField
				{...props}
				value={value}
				setValue={(v) => {
					setValue(v)
					addLog(`setValue("${v}")`)
				}}
				onBlur={() => addLog('onBlur fired')}
				onKeyDown={(e) => addLog(`onKeyDown: key="${e.key}"`)}
			/>
			<div
				style={{
					fontFamily: 'monospace',
					fontSize: 11,
					background: '#1e1e1e',
					color: '#d4d4d4',
					padding: '6px 8px',
					borderRadius: 4,
					minHeight: 60,
					maxHeight: 160,
					overflowY: 'auto',
				}}
			>
				{log.length === 0 ? (
					<span style={{ color: '#666' }}>events will appear here…</span>
				) : (
					log.map((entry, i) => <div key={i}>{entry}</div>)
				)}
			</div>
		</div>
	)
}

const meta = {
	component: TextInputField,
	args: {
		id: undefined,
		value: '',
		setValue: () => {},
		tooltip: '',
		disabled: false,
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ value: string }>()
		return <TextInputField {...args} setValue={(v) => setArgs({ value: v })} />
	},
} satisfies Meta<typeof TextInputField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithPlaceholder: Story = {
	args: { placeholder: 'Type something…' },
}

export const Multiline: Story = {
	args: { multiline: true, value: 'Line one\nLine two' },
}

export const WithValidation: Story = {
	args: {
		value: 'hi',
		checkValid: (v) => v.length >= 5,
	},
}

export const Disabled: Story = {
	args: { value: 'Read-only text', disabled: true },
}

const withMenuPortalDecorator: Decorator = (Story) => (
	<MenuPortalContext.Provider value={document.body}>
		<Story />
	</MenuPortalContext.Provider>
)

const withVariablesDecorators: Decorator[] = [withMockStore, withMenuPortalDecorator]

export const WithVariables: Story = {
	decorators: withVariablesDecorators,
	args: { useVariables: true, value: '$(internal:time_hms)' },
}

export const WithVariablesAndLocalVars: Story = {
	decorators: withVariablesDecorators,
	args: {
		useVariables: true,
		value: '$(local:pressed)',
		localVariables: [
			{ value: 'local:pressed', label: 'pressed — Whether the button is pressed' },
			{ value: 'local:surface_id', label: 'surface_id — ID of the triggering surface' },
		],
	},
}

export const MultilineWithVariables: Story = {
	decorators: withVariablesDecorators,
	args: {
		useVariables: true,
		multiline: true,
		value: 'Line 1: $(internal:time_hms)\nLine 2: $(internal:date)',
	},
}

export const WithTooltip: Story = {
	args: { value: 'Hover over me', tooltip: 'This is a helpful tooltip for the field' },
}

export const WithValidationValid: Story = {
	args: {
		value: 'valid input',
		checkValid: (v) => v.length >= 5,
	},
}

export const WithStyle: Story = {
	args: { value: 'Custom styled', className: 'font-monospace bg-light' },
}

export const WithCallbacks: Story = {
	render: (args) => <WithEventLog {...args} />,
	args: { value: 'Type or blur me' },
}

export const WithCallbacksMultiline: Story = {
	render: (args) => <WithEventLog {...args} />,
	args: { value: 'Line 1\nLine 2', multiline: true },
}

export const WithAutoFocus: Story = {
	render: (args) => <WithEventLog {...args} />,
	args: { value: '', placeholder: 'Should be focused on load', autoFocus: true },
}
