import { ExpressionOrValue, ButtonGraphicsElementBase } from '@companion-app/shared/Model/StyleLayersModel.js'
import { CFormLabel, CCol, CButton } from '@coreui/react'
import { faFilter, faSquareRootVariable } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import React, { useCallback } from 'react'
import { TextInputField } from '~/Components/TextInputField.js'
import { observer } from 'mobx-react-lite'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useElementPropertiesContext } from './useElementPropertiesContext.js'
import { InputFeatureIcons, InputFeatureIconsProps } from '~/Controls/OptionsInputField.js'

type ExtractValue<T> = T extends ExpressionOrValue<infer U> ? U : never
type SetValueFn<TObj, TKey extends keyof TObj> = (value: ExtractValue<TObj[TKey]>) => void

export interface InputFieldCommonProps<TObj, TKey extends keyof TObj> {
	elementProp: { value: ExtractValue<TObj[TKey]> }
	setValue: SetValueFn<TObj, TKey>
}

interface FormPropertyFieldProps<TObj, TKey extends keyof TObj> {
	elementProps: TObj
	property: TKey
	label: string | React.ReactNode
	features?: InputFeatureIconsProps
	children: (elementProp: { value: ExtractValue<TObj[TKey]> }, setValue: SetValueFn<TObj, TKey>) => React.ReactNode
}
export const FormPropertyField = observer(function FormPropertyField<
	TObj extends ButtonGraphicsElementBase,
	TKey extends string & keyof TObj,
>({ elementProps, property, label, features, children }: FormPropertyFieldProps<TObj, TKey>) {
	const { controlId, localVariablesStore } = useElementPropertiesContext()
	const updateOptionValueMutation = useMutationExt(trpc.controls.styles.updateOptionValue.mutationOptions())
	const updateOptionIsExpressionMutation = useMutationExt(
		trpc.controls.styles.updateOptionIsExpression.mutationOptions()
	)

	const elementId = elementProps.id

	const setValue = useCallback(
		(value: ExtractValue<TObj[TKey]>) => {
			updateOptionValueMutation
				.mutateAsync({ controlId, elementId, key: property, value })
				.then((res) => {
					console.log('Update element', res)
				})
				.catch((e) => {
					console.error('Failed to Update element', e)
				})
		},
		[updateOptionValueMutation, controlId, elementId, property]
	)

	const setIsExpression = useCallback(
		(value: boolean) => {
			updateOptionIsExpressionMutation
				.mutateAsync({ controlId, elementId, key: property, value })
				.then((res) => {
					console.log('Update element', res)
				})
				.catch((e) => {
					console.error('Failed to Update element', e)
				})
		},
		[updateOptionIsExpressionMutation, controlId, elementId, property]
	)

	const elementProp = elementProps[property] as ExpressionOrValue<any>
	const toggleExpression = useCallback(() => setIsExpression(!elementProp.isExpression), [setIsExpression, elementProp])

	return (
		<>
			<CFormLabel className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				{label}
				{!elementProp.isExpression && <InputFeatureIcons {...features} />}
			</CFormLabel>
			<CCol sm={8} className="field-with-expression">
				<div className="expression-field">
					{elementProp.isExpression ? (
						<TextInputField
							setValue={setValue as (value: string) => void}
							value={elementProp.value ?? ''}
							useVariables
							localVariables={localVariablesStore.getOptions(null, false, true)}
							isExpression
						/>
					) : (
						children(elementProp, setValue)
					)}
				</div>
				<div className="expression-toggle-button">
					<CButton
						color="info"
						variant="outline"
						onClick={toggleExpression}
						title={elementProp.isExpression ? 'Expression mode ' : 'Value mode'}
					>
						<FontAwesomeIcon icon={elementProp.isExpression ? faSquareRootVariable : faFilter} />
					</CButton>
				</div>
			</CCol>
		</>
	)
})
