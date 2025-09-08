import { ExpressionOrValue } from '@companion-app/shared/Model/StyleLayersModel.js'
import { CButton } from '@coreui/react'
import { faFilter, faSquareRootVariable } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback } from 'react'
import { TextInputField } from '~/Components/TextInputField.js'
import { observer } from 'mobx-react-lite'
import { LocalVariablesStore } from '../LocalVariablesStore.js'

interface ExpressionFieldControlProps {
	value: ExpressionOrValue<any>
	setValue: (value: any) => void
	setIsExpression: (isExpression: boolean) => void
	localVariablesStore: LocalVariablesStore | null
	children: (value: any, setValue: (value: any) => void) => React.ReactNode
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
					<TextInputField
						setValue={setValue as (value: string) => void}
						value={value.value ?? ''}
						useVariables
						localVariables={localVariablesStore?.getOptions(null, false, true)}
						isExpression
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
