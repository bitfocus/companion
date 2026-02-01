import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { CFormLabel, CCol } from '@coreui/react'
import { faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import React, { useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useElementPropertiesContext } from './useElementPropertiesContext.js'
import { InputFeatureIcons, type InputFeatureIconsProps } from '~/Controls/OptionsInputField.js'
import { ExpressionFieldControl } from '~/Controls/Components/ExpressionFieldControl.js'
import type { JsonValue } from 'type-fest'

type SetValueFn = (value: JsonValue | undefined) => void

export interface InputFieldCommonProps {
	elementProp: { value: any }
	setValue: SetValueFn
}

interface FormPropertyFieldProps {
	elementProps: Record<string, any>
	property: string
	label: string
	features?: InputFeatureIconsProps
	children: (elementProp: { value: JsonValue | undefined }, setValue: SetValueFn) => React.ReactNode
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

	const isOverridden = isPropertyOverridden(elementId, property)

	return (
		<>
			<CFormLabel className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				{label}
				<InputFeatureIcons {...(elementProp.isExpression ? { variables: true, local: true } : features)} />
				{isOverridden ? (
					<span title="Value is affected by a feedback">
						<FontAwesomeIcon icon={faLayerGroup} />
					</span>
				) : null}
			</CFormLabel>
			<CCol sm={8}>
				<ExpressionFieldControl
					value={elementProp}
					setValue={setValue}
					setIsExpression={setIsExpression}
					localVariablesStore={localVariablesStore}
				>
					{(value, setValue) => children({ value }, setValue)}
				</ExpressionFieldControl>
			</CCol>
		</>
	)
})
