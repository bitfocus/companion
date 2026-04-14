import { CButton } from '@coreui/react'
import { faFilter, faSquareRootVariable } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useState } from 'react'
import { ExpressionInputField } from './ExpressionInputField'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { observer } from 'mobx-react-lite'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import {
	ParseExpression,
	tryExtractExpressionPlainValue,
	valueToExpressionLiteral,
} from '@companion-app/shared/Expression/ExpressionParse.js'
import { ExpressionConversionModal } from './ExpressionConversionModal.js'
import type { JsonValue } from 'type-fest'

interface FieldOrExpressionProps {
	localVariablesStore: LocalVariablesStore | null
	value: ExpressionOrValue<JsonValue | undefined>
	setValue: (value: ExpressionOrValue<JsonValue | undefined>) => void
	disabled: boolean

	controlId: string | null

	entityType: EntityModelType | null
	isLocatedInGrid: boolean

	children: React.ReactNode
}
export const FieldOrExpression = observer(function FieldOrExpression({
	localVariablesStore,
	value,
	setValue,
	disabled,
	controlId,
	entityType,
	isLocatedInGrid,
	children,
}: FieldOrExpressionProps) {
	const [pendingConversion, setPendingConversion] = useState<string | null>(null)

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
			if (isExpression) {
				setValue({
					isExpression: true,
					value: valueToExpressionLiteral(value.value),
				})
			} else {
				// If the expression is a plain value literal, extract it directly without a modal
				const expressionStr = stringifyVariableValue(value.value) ?? ''
				try {
					const parsed = ParseExpression(expressionStr)
					const plain = tryExtractExpressionPlainValue(parsed)
					if (plain !== null) {
						setValue({ isExpression: false, value: plain.value })
						return
					}
				} catch {
					// parse failed — fall through to modal
				}
				setPendingConversion(expressionStr)
			}
		},
		[setValue, value]
	)

	const toggleExpression = useCallback(
		() => setIsExpression(!value.isExpression),
		[setIsExpression, value.isExpression]
	)

	const onConversionConfirm = useCallback(
		(computedValue: JsonValue | undefined) => {
			setPendingConversion(null)
			setValue({ isExpression: false, value: computedValue })
		},
		[setValue]
	)

	const onConversionCancel = useCallback(() => {
		setPendingConversion(null)
	}, [])

	return (
		<div className="field-with-expression">
			{pendingConversion !== null && (
				<ExpressionConversionModal
					expression={pendingConversion}
					controlId={controlId}
					onConfirm={onConversionConfirm}
					onCancel={onConversionCancel}
				/>
			)}
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
