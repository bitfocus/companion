import {
	ButtonGraphicsCanvasElement,
	ButtonGraphicsDecorationType,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { DropdownInputField } from '../../../Components/DropdownInputField.js'
import { DropdownChoice, DropdownChoiceId } from '@companion-module/base'
import { ColorInputField } from '../../../Components/ColorInputField.js'
import { FormPropertyField, InputFieldCommonProps } from './ElementPropertiesUtil.js'

export const CanvasElementPropertiesEditor = observer(function CanvasElementPropertiesEditor({
	controlId,
	elementProps,
}: {
	controlId: string
	elementProps: Readonly<ButtonGraphicsCanvasElement>
}) {
	return (
		<>
			<FormPropertyField controlId={controlId} elementProps={elementProps} property="color" label="Color">
				{(elementProp, setValue) => <FieldFillColorInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<FormPropertyField controlId={controlId} elementProps={elementProps} property="decoration" label="Decoration">
				{(elementProp, setValue) => <FieldDecorationInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>
		</>
	)
})

const FieldFillColorInput = observer(function FieldFillColorInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsCanvasElement, 'color'>) {
	return (
		<ColorInputField
			setValue={setValue as (color: number | string) => void}
			value={elementProp.value}
			returnType="number"
			helpText="Background color"
		/>
	)
})

const FieldDecorationInput = observer(function FieldDecorationInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsCanvasElement, 'decoration'>) {
	return (
		<DropdownInputField
			choices={DecorationChoices}
			setValue={setValue as (value: DropdownChoiceId) => void}
			value={elementProp.value}
		/>
	)
})

const DecorationChoices: DropdownChoice[] = [
	{ id: ButtonGraphicsDecorationType.FollowDefault, label: 'Follow default' },
	{ id: ButtonGraphicsDecorationType.TopBar, label: 'Top bar' },
	{ id: ButtonGraphicsDecorationType.Border, label: 'Border when pressed' },
]
