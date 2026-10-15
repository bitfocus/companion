import { observer } from 'mobx-react-lite'
import type { JsonValue } from 'type-fest'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import { FieldOrExpression } from '~/Components/FieldOrExpression.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { EntityListActionContext, useLocalVariablesStore } from '~/Controls/LocalVariablesStore.js'

interface ButtonLocationInputProps {
	inputId: string
	controlId: string
	value: ExpressionOrValue<string>
	setValue: (value: ExpressionOrValue<string>) => void
}

/**
 * A `page/row/column` location of a button, as plain text with variables or as an expression. Used by the buttons
 * that point at another button.
 */
export const ButtonLocationInput = observer(function ButtonLocationInput({
	inputId,
	controlId,
	value,
	setValue,
}: ButtonLocationInputProps) {
	const localVariablesStore = useLocalVariablesStore(controlId, null)
	const localVariables = localVariablesStore.getOptions({
		entityType: null,
		internalParser: true,
		isLocatedInGrid: true,
		actionContext: EntityListActionContext.NotActions,
	})

	return (
		<FieldOrExpression
			inputId={inputId}
			localVariablesStore={localVariablesStore}
			value={value}
			setValue={(v: ExpressionOrValue<JsonValue | undefined>) =>
				setValue({ isExpression: v.isExpression, value: stringifyVariableValue(v.value) ?? '' })
			}
			disabled={false}
			entityType={null}
			isLocatedInGrid={true}
		>
			<TextInputField
				id={inputId}
				value={value.value}
				setValue={(v) => setValue({ isExpression: false, value: v })}
				useVariables
				localVariables={localVariables}
				placeholder="page/row/column, e.g. 1/0/0"
			/>
		</FieldOrExpression>
	)
})
