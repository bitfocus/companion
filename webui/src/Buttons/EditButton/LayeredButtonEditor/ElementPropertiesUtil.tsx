import { ExpressionOrValue } from '@companion-app/shared/Model/StyleLayersModel.js'
import { CFormLabel, CCol, CButton } from '@coreui/react'
import { faFilter, faSquareRootVariable, faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import React, { useCallback } from 'react'
import { TextInputField } from '~/Components/TextInputField.js'
import { observer } from 'mobx-react-lite'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useElementPropertiesContext } from './useElementPropertiesContext.js'
import { InputFeatureIcons, InputFeatureIconsProps } from '~/Controls/OptionsInputField.js'

type SetValueFn = (value: any) => void

export interface InputFieldCommonProps {
	elementProp: { value: any }
	setValue: SetValueFn
}

interface FormPropertyFieldProps {
	elementProps: Record<string, any>
	property: string
	label: string
	features?: InputFeatureIconsProps
	children: (elementProp: { value: any }, setValue: SetValueFn) => React.ReactNode
}
export const FormPropertyField = observer(function FormPropertyField({
	elementProps,
	property,
	label,
	features,
	children,
}: FormPropertyFieldProps) {
	const { controlId, localVariablesStore, isPropertyOverridden } = useElementPropertiesContext()

	const updateOptionValueMutation = useMutationExt(trpc.controls.styles.updateOptionValue.mutationOptions())
	const updateOptionIsExpressionMutation = useMutationExt(
		trpc.controls.styles.updateOptionIsExpression.mutationOptions()
	)

	const elementId = elementProps.id

	const setValue = useCallback(
		(value: any) => {
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

	const isOverridden = isPropertyOverridden(elementId, property)

	return (
		<>
			<CFormLabel className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				{label}
				{!elementProp.isExpression && <InputFeatureIcons {...features} />}
				{isOverridden ? (
					<span title="Value is affected by at least one feedback">
						<FontAwesomeIcon icon={faLayerGroup} />
					</span>
				) : null}
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
