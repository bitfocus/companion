import { CCol, CFormLabel } from '@coreui/react'
import { faLayerGroup, faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useCallback } from 'react'
import type { JsonValue } from 'type-fest'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { FieldOrExpression } from '~/Components/FieldOrExpression.js'
import { InlineHelp } from '~/Components/InlineHelp.js'
import { InputFeatureIcons, type InputFeatureIconsProps } from '~/Controls/OptionsInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useElementPropertiesContext } from './useElementPropertiesContext.js'

type SetValueFn = (value: JsonValue | undefined) => void

export interface InputFieldCommonProps {
	elementProp: { value: JsonValue | undefined }
	setValue: SetValueFn
}

interface FormPropertyFieldProps {
	elementProps: Record<string, any>
	property: string
	label: string
	tooltip: string | undefined
	features?: InputFeatureIconsProps
	children: (elementProp: { value: JsonValue | undefined }, setValue: SetValueFn) => React.ReactNode
}
export const FormPropertyField = observer(function FormPropertyField({
	elementProps,
	property,
	label,
	tooltip,
	features,
	children,
}: FormPropertyFieldProps) {
	const { controlId, localVariablesStore, isPropertyOverridden } = useElementPropertiesContext()

	const updateOptionMutation = useMutationExt(trpc.controls.styles.updateOption.mutationOptions())

	const elementId = elementProps.id

	const elementProp = (elementProps[property] as ExpressionOrValue<JsonValue | undefined>) || {
		isExpression: false,
		value: undefined,
	}

	const setExpressionOrValue = useCallback(
		(newVal: ExpressionOrValue<JsonValue | undefined>) => {
			updateOptionMutation.mutateAsync({ controlId, elementId, key: property, value: newVal }).catch((e) => {
				console.error('Failed to Update element', e)
			})
		},
		[updateOptionMutation, controlId, elementId, property]
	)

	const setInnerValue = useCallback(
		(innerValue: JsonValue | undefined) => setExpressionOrValue({ isExpression: false, value: innerValue }),
		[setExpressionOrValue]
	)

	const isOverridden = isPropertyOverridden(elementId, property)

	return (
		<>
			<CFormLabel className={'col-sm-4 col-form-label col-form-label-sm'}>
				{label}
				<InputFeatureIcons {...(elementProp.isExpression ? { variables: true, local: true } : features)} />
				{tooltip && (
					<InlineHelp help={tooltip}>
						<FontAwesomeIcon style={{ marginLeft: '5px' }} icon={faQuestionCircle} />
					</InlineHelp>
				)}
				{isOverridden ? (
					<span title="Value has a linked feedback override">
						<FontAwesomeIcon icon={faLayerGroup} />
					</span>
				) : null}
			</CFormLabel>
			<CCol sm={8}>
				<FieldOrExpression
					value={elementProp}
					setValue={setExpressionOrValue}
					localVariablesStore={localVariablesStore}
					entityType={null}
					isLocatedInGrid={true}
					disabled={false}
				>
					{children({ value: elementProp.value }, setInnerValue)}
				</FieldOrExpression>
			</CCol>
		</>
	)
})
