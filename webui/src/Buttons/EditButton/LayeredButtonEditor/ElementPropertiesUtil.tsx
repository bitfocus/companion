import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import type { JsonValue } from 'type-fest'
import type {
	ExpressionableOptionsObject,
	ExpressionOrValue,
	SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { PropertyFieldRow } from '~/Components/PropertyFieldRow.js'
import type { InputFeatureIconsProps } from '~/Controls/InputFeatures.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { PinPropertyToggle } from './PinPropertyToggle.js'
import { useElementPropertiesContext } from './useElementPropertiesContext.js'

type SetValueFn = (value: JsonValue | undefined) => void

export interface InputFieldCommonProps {
	elementProp: { value: JsonValue | undefined }
	setValue: SetValueFn
}

interface FormPropertyFieldProps {
	elementProps: Readonly<SomeButtonGraphicsElement>
	property: string
	fieldDefinition: SomeCompanionInputField
	label: string
	tooltip: string | undefined
	description?: string
	expressionDescription?: string
	features: InputFeatureIconsProps | undefined
	disableAutoExpression: boolean | undefined
	children: (elementProp: { value: JsonValue | undefined }, setValue: SetValueFn, inputId: string) => React.ReactNode
}
export const FormPropertyField = observer(function FormPropertyField({
	elementProps,
	property,
	fieldDefinition,
	label,
	tooltip,
	description,
	expressionDescription,
	features,
	disableAutoExpression,
	children,
}: FormPropertyFieldProps) {
	const { controlId, localVariablesStore, isPropertyOverridden } = useElementPropertiesContext()
	const updateOptionMutation = useMutationExt(trpc.controls.styles.updateOption.mutationOptions())
	const elementId = elementProps.id

	// The element types have no index signature, so reach the property being edited through its key
	const elementProp = ((elementProps as Record<string, unknown>)[property] as
		ExpressionOrValue<JsonValue | undefined> | undefined) || {
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
			description={description}
			expressionDescription={expressionDescription}
			features={features}
			pinToggle={<PinPropertyToggle elementProps={elementProps} property={property} />}
			isOverridden={isOverridden}
			value={elementProp}
			setValue={setExpressionOrValue}
			disableAutoExpression={disableAutoExpression}
			localVariablesStore={localVariablesStore}
			entityType={null}
			fieldDefinition={fieldDefinition}
			controlId={controlId}
			allRawOptions={elementProps as unknown as ExpressionableOptionsObject}
			isLocatedInGrid={true}
			disabled={false}
		>
			{children}
		</PropertyFieldRow>
	)
})
