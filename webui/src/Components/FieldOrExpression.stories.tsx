import type { Meta, StoryObj } from '@storybook/react'
import { useArgs } from 'storybook/preview-api'
import type { JsonValue } from 'type-fest'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import { withMockStore } from '../../.storybook/mockRootAppStore'
import { FieldOrExpression } from './FieldOrExpression'
import { TextInputField } from './TextInputField'

const meta = {
	component: FieldOrExpression,
	decorators: [withMockStore],
	args: {
		localVariablesStore: null,
		value: { isExpression: false, value: 'hello' } satisfies ExpressionOrValue<JsonValue | undefined>,
		setValue: () => {},
		disabled: false,
		entityType: null,
		isLocatedInGrid: false,
		children: null,
	},
	render: function Render(args) {
		const [, setArgs] = useArgs<{ value: ExpressionOrValue<JsonValue | undefined> }>()
		return (
			<FieldOrExpression {...args} setValue={(v) => setArgs({ value: v })}>
				<TextInputField
					value={stringifyVariableValue(args.value.value) ?? ''}
					setValue={() => {}}
					disabled={args.disabled}
				/>
			</FieldOrExpression>
		)
	},
} satisfies Meta<typeof FieldOrExpression>

export default meta
type Story = StoryObj<typeof meta>

export const PlainValue: Story = {}

export const AsExpression: Story = {
	args: { value: { isExpression: true, value: '$(internal:time_hms)' } },
}

export const Disabled: Story = {
	args: { disabled: true },
}
