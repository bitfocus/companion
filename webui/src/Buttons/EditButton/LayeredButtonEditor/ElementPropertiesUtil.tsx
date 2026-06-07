import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import type { JsonValue } from 'type-fest'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { PropertyFieldRow } from '~/Components/PropertyFieldRow.js'
import type { InputFeatureIconsProps } from '~/Controls/InputFeatures.js'
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
	features: InputFeatureIconsProps | undefined
	disableAutoExpression: boolean | undefined
	children: (elementProp: { value: JsonValue | undefined }, setValue: SetValueFn, inputId: string) => React.ReactNode
}
export const FormPropertyField = observer(function FormPropertyField({
	elementProps,
	property,
	label,
	tooltip,
	features,
	disableAutoExpression,
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

	const isOverridden = isPropertyOverridden(elementId, property)

	return (
		<PropertyFieldRow
			label={label}
			tooltip={tooltip}
			features={features}
			isOverridden={isOverridden}
			value={elementProp}
			setValue={setExpressionOrValue}
			disableAutoExpression={disableAutoExpression}
			localVariablesStore={localVariablesStore}
			entityType={null}
			isLocatedInGrid={true}
			disabled={false}
		>
			{children}
		</PropertyFieldRow>
	)
})
