import { observer } from 'mobx-react-lite'
import React from 'react'
import { ColorInputField } from '~/Components/ColorInputField.js'
import { FormPropertyField, InputFieldCommonProps } from './ElementPropertiesUtil.js'
import { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { NumberInputField } from '~/Components/NumberInputField.js'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { DropdownChoice, DropdownChoiceId } from '@companion-module/base'
import {
	ButtonGraphicsBorderProperties,
	ButtonGraphicsElementBase,
	MakeExpressionable,
} from '@companion-app/shared/Model/StyleLayersModel.js'

type ElementWithBorderProps = ButtonGraphicsElementBase &
	MakeExpressionable<ButtonGraphicsBorderProperties & { type: string }>

interface BorderPropertiesEditorProps {
	controlId: string
	elementProps: Readonly<ElementWithBorderProps>
	localVariablesStore: LocalVariablesStore
	borderName?: string // Optional name for the border, if needed
}

export const BorderPropertiesEditor = observer(function BorderPropertiesEditor({
	controlId,
	elementProps,
	localVariablesStore,
	borderName,
}: BorderPropertiesEditorProps) {
	if (!borderName) borderName = 'Border'

	return (
		<>
			<FormPropertyField
				controlId={controlId}
				elementProps={elementProps}
				localVariablesStore={localVariablesStore}
				property="borderWidth"
				label={`${borderName} Width`}
			>
				{(elementProp, setValue) => <FieldBorderWidthInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<FormPropertyField
				controlId={controlId}
				elementProps={elementProps}
				localVariablesStore={localVariablesStore}
				property="borderColor"
				label={`${borderName} Color`}
			>
				{(elementProp, setValue) => <FieldBorderColorInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<FormPropertyField
				controlId={controlId}
				elementProps={elementProps}
				localVariablesStore={localVariablesStore}
				property="borderPosition"
				label={`${borderName} Position`}
			>
				{(elementProp, setValue) => <FieldBorderPositionInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>
		</>
	)
})

const FieldBorderWidthInput = observer(function FieldBorderWidthInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ElementWithBorderProps, 'borderWidth'>) {
	return <NumberInputField setValue={setValue} value={Number(elementProp.value)} min={0} max={100} step={1} />
})

const FieldBorderColorInput = observer(function FieldBorderColorInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ElementWithBorderProps, 'borderColor'>) {
	return (
		<ColorInputField
			setValue={setValue as (color: number | string) => void}
			value={elementProp.value}
			returnType="number"
			enableAlpha
		/>
	)
})

const FieldBorderPositionInput = observer(function FieldBorderPositionInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ElementWithBorderProps, 'borderPosition'>) {
	return (
		<DropdownInputField
			choices={BorderPositionChoices}
			setValue={setValue as (value: DropdownChoiceId) => void}
			value={elementProp.value}
		/>
	)
})

const BorderPositionChoices: DropdownChoice[] = [
	{ id: 'inside', label: 'Inside' },
	{ id: 'center', label: 'Center' },
	{ id: 'outside', label: 'Outside' },
]
