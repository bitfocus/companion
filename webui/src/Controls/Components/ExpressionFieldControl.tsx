import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { CButton } from '@coreui/react'
import { faFilter, faSquareRootVariable } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import type { LocalVariablesStore } from '../LocalVariablesStore.js'
import { ExpressionInputField } from '~/Components/ExpressionInputField.js'
import type { JsonValue } from 'type-fest'

interface ExpressionFieldControlProps {
	value: ExpressionOrValue<any>
	setValue: (value: JsonValue | undefined) => void
	setIsExpression: (isExpression: boolean) => void
	localVariablesStore: LocalVariablesStore | null
	children: (value: JsonValue | undefined, setValue: (value: JsonValue | undefined) => void) => React.ReactNode
}

export const ExpressionFieldControl = observer(function ExpressionFieldControl({
	value,
	setValue,
	setIsExpression,
	localVariablesStore,
	children,
}: ExpressionFieldControlProps) {
	const toggleExpression = useCallback(() => {
		setIsExpression(!value.isExpression)
	}, [setIsExpression, value.isExpression])

	return (
		<div className="field-with-expression">
			<div className="expression-field">
				{value.isExpression ? (
					<ExpressionInputField
						setValue={setValue as (value: string) => void}
						value={value.value ?? ''}
						localVariables={localVariablesStore?.getOptions(null, false, true)}
					/>
				) : (
					children(value.value, setValue)
				)}
			</div>
			<div className="expression-toggle-button">
				<CButton
					color="info"
					variant="outline"
					onClick={toggleExpression}
					title={value.isExpression ? 'Expression mode' : 'Value mode'}
				>
					<FontAwesomeIcon icon={value.isExpression ? faSquareRootVariable : faFilter} />
				</CButton>
			</div>
		</div>
	)
})
