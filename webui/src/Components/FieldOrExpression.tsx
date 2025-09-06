import { CButton } from '@coreui/react'
import { faFilter, faSquareRootVariable } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback } from 'react'
import { ExpressionInputField } from './ExpressionInputField'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { observer } from 'mobx-react-lite'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'

interface FormPropertyFieldProps {
	localVariablesStore: LocalVariablesStore
	value: ExpressionOrValue<any>
	setValue: (value: ExpressionOrValue<any>) => void
	children: React.ReactNode
}
export const FieldOrExpression = observer(function FieldOrExpression({
	localVariablesStore,
	value,
	setValue,
	children,
}: FormPropertyFieldProps) {
	const setExpression = useCallback(
		(value: any) => {
			console.log('set expression', value)
			setValue({
				isExpression: true,
				value,
			})
		},
		[setValue]
	)

	const setIsExpression = useCallback(
		(isExpression: boolean) => {
			console.log('setIsExpression', isExpression)
			setValue({
				isExpression,
				value: value.value,
			})
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
						setValue={setExpression as (value: string) => void}
						value={value.value ?? ''}
						localVariables={localVariablesStore.getOptions(null, false, true)} // nocommit - the args here
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
					title={value.isExpression ? 'Expression mode ' : 'Value mode'}
				>
					<FontAwesomeIcon icon={value.isExpression ? faSquareRootVariable : faFilter} />
				</CButton>
			</div>
		</div>
	)
})
