import { ButtonGraphicsBoxElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { ColorInputField } from '../../../Components/ColorInputField.js'
import { FormPropertyField, InputFieldCommonProps } from './ElementPropertiesUtil.js'
import { LocalVariablesStore } from '../../../Controls/LocalVariablesStore.js'

export const BoxElementPropertiesEditor = observer(function BoxElementPropertiesEditor({
	controlId,
	elementProps,
	localVariablesStore,
}: {
	controlId: string
	elementProps: Readonly<ButtonGraphicsBoxElement>
	localVariablesStore: LocalVariablesStore
}) {
	return (
		<>
			<FormPropertyField
				controlId={controlId}
				elementProps={elementProps}
				localVariablesStore={localVariablesStore}
				property="color"
				label="Color"
			>
				{(elementProp, setValue) => <FieldFillColorInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>
		</>
	)
})

const FieldFillColorInput = observer(function FieldFillColorInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsBoxElement, 'color'>) {
	return (
		<ColorInputField
			setValue={setValue as (color: number | string) => void}
			value={elementProp.value}
			returnType="number"
			helpText="Fill color"
		/>
	)
})
