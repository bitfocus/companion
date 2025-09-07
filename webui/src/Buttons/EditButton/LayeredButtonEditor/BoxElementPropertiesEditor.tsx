import { ButtonGraphicsBoxElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { ColorInputField } from '~/Components/ColorInputField.js'
import { FormPropertyField, InputFieldCommonProps } from './ElementPropertiesUtil.js'
import { ElementBoundsProperties } from './ElementBoundsProperties.js'
import { BorderPropertiesEditor } from './BorderPropertiesEditor.js'

export const BoxElementPropertiesEditor = observer(function BoxElementPropertiesEditor({
	elementProps,
}: {
	elementProps: Readonly<ButtonGraphicsBoxElement>
}) {
	return (
		<>
			<ElementBoundsProperties elementProps={elementProps} />

			<FormPropertyField elementProps={elementProps} property="color" label="Color">
				{(elementProp, setValue) => <FieldFillColorInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<BorderPropertiesEditor elementProps={elementProps} />
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
			enableAlpha
		/>
	)
})
