import { CButton } from '@coreui/react'
import { faFilter, faSquareRootVariable } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback } from 'react'
import { ExpressionInputField } from './ExpressionInputField'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { observer } from 'mobx-react-lite'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import type { JsonValue } from 'type-fest'

interface FieldOrExpressionProps {
	localVariablesStore: LocalVariablesStore | null
	value: ExpressionOrValue<JsonValue | undefined>
	setValue: (value: ExpressionOrValue<JsonValue | undefined>) => void
	disabled: boolean

	entityType: EntityModelType | null
	isLocatedInGrid: boolean

	children: React.ReactNode
}
export const FieldOrExpression = observer(function FieldOrExpression({
	localVariablesStore,
	value,
	setValue,
	disabled,
	entityType,
	isLocatedInGrid,
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

	return (
		<div className="field-with-expression">
			<div className="expression-field">
				{value.isExpression ? (
					<ExpressionInputField
						setValue={setExpression}
						value={stringifyVariableValue(value.value) ?? ''}
						localVariables={localVariablesStore?.getOptions(entityType, true, isLocatedInGrid)}
						disabled={disabled}
					/>
				) : (
					children
				)}
			</div>
			<div className="expression-toggle-button">
				<CButton
					color="info"
					variant="outline"
					onClick={toggleExpression}
					title={value.isExpression ? 'Expression mode' : 'Value mode'}
					disabled={disabled}
				>
					<FontAwesomeIcon icon={value.isExpression ? faSquareRootVariable : faFilter} />
				</CButton>
			</div>
		</div>
	)
})
