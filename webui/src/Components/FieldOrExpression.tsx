import { faFilter, faSquareRootVariable } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import type { JsonValue } from 'type-fest'
import type { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import type { DropdownChoiceInt } from '~/Components/DropdownChoices.js'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { useComputed } from '~/Resources/util'
import { Button } from './Button'
import { ExpressionInputField } from './ExpressionInputField'

interface FieldOrExpressionProps {
	inputId: string | undefined
	localVariablesStore: LocalVariablesStore | null
	value: ExpressionOrValue<JsonValue | undefined>
	setValue: (value: ExpressionOrValue<JsonValue | undefined>) => void
	disabled: boolean

	entityType: EntityModelType | null
	isLocatedInGrid: boolean

	/** Extra variable entries to append to the expression-mode variable picker */
	extraLocalVariables?: DropdownChoiceInt[]

	children: React.ReactNode
}
export const FieldOrExpression = observer(function FieldOrExpression({
	inputId,
	localVariablesStore,
	value,
	setValue,
	disabled,
	entityType,
	isLocatedInGrid,
	extraLocalVariables,
	children,
}: FieldOrExpressionProps) {
	const setExpression = useCallback(
		(value: string) => {
			setValue({
				isExpression: true,
				value: value,
			})
		},
		[setValue]
	)

	const setIsExpression = useCallback(
		(isExpression: boolean) => {
			setValue(
				isExpression
					? {
							isExpression: true,
							value: stringifyVariableValue(value.value) ?? '',
						}
					: {
							isExpression: false,
							value: value.value,
						}
			)
		},
		[setValue, value]
	)

	const toggleExpression = useCallback(
		() => setIsExpression(!value.isExpression),
		[setIsExpression, value.isExpression]
	)

	const expressionLocalVariables = useComputed(
		() => [
			...(localVariablesStore?.getOptions(entityType, true, isLocatedInGrid) ?? []),
			...(extraLocalVariables ?? []),
		],
		[localVariablesStore, extraLocalVariables, entityType, isLocatedInGrid]
	)

	return (
		<div className="field-with-expression">
			<div className="expression-field">
				{value.isExpression ? (
					<ExpressionInputField
						id={inputId}
						setValue={setExpression}
						value={stringifyVariableValue(value.value) ?? ''}
						localVariables={expressionLocalVariables.length > 0 ? expressionLocalVariables : undefined}
						disabled={disabled}
					/>
				) : (
					children
				)}
			</div>
			<div className="expression-toggle-button">
				<Button
					color="info"
					variant="outline"
					onClick={toggleExpression}
					title={value.isExpression ? 'Expression mode' : 'Value mode'}
					aria-label={value.isExpression ? 'Switch to value mode' : 'Switch to expression mode'}
					disabled={disabled}
				>
					<FontAwesomeIcon icon={value.isExpression ? faSquareRootVariable : faFilter} />
				</Button>
			</div>
		</div>
	)
})
