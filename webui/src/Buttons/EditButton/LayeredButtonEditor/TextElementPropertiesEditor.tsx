import { ButtonGraphicsTextElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { InlineHelp } from '../../../Components/InlineHelp.js'
import { TextInputField } from '../../../Components/TextInputField.js'
import { InputFeatureIcons, InputFeatureIconsProps } from '../../../Controls/OptionsInputField.js'
import { LocalVariablesStore } from '../../../Controls/LocalVariablesStore.js'
import { DropdownInputField } from '../../../Components/DropdownInputField.js'
import { DropdownChoice, DropdownChoiceId } from '@companion-module/base'
import { ColorInputField } from '../../../Components/ColorInputField.js'
import { HorizontalAlignmentInputField, VerticalAlignmentInputField } from '../../../Components/AlignmentInputField.js'
import { FormPropertyField, InputFieldCommonProps } from './ElementPropertiesUtil.js'
import { ElementBoundsProperties } from './ElementBoundsProperties.js'

export const TextElementPropertiesEditor = observer(function TextElementPropertiesEditor({
	controlId,
	elementProps,
	localVariablesStore,
}: {
	controlId: string
	elementProps: Readonly<ButtonGraphicsTextElement>
	localVariablesStore: LocalVariablesStore
}) {
	return (
		<>
			<ElementBoundsProperties
				controlId={controlId}
				elementProps={elementProps}
				localVariablesStore={localVariablesStore}
			/>

			<FormPropertyField
				controlId={controlId}
				elementProps={elementProps}
				localVariablesStore={localVariablesStore}
				property="text"
				label={<FieldTextLabel elementProps={elementProps} />}
			>
				{(elementProp, setValue) => (
					<FieldTextInput elementProp={elementProp} localVariablesStore={localVariablesStore} setValue={setValue} />
				)}
			</FormPropertyField>

			<FormPropertyField
				controlId={controlId}
				elementProps={elementProps}
				localVariablesStore={localVariablesStore}
				property="fontsize"
				label="Text Size"
			>
				{(elementProp, setValue) => <FieldFontSizeInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<FormPropertyField
				controlId={controlId}
				elementProps={elementProps}
				localVariablesStore={localVariablesStore}
				property="color"
				label="Color"
			>
				{(elementProp, setValue) => <FieldTextColorInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<FormPropertyField
				controlId={controlId}
				elementProps={elementProps}
				localVariablesStore={localVariablesStore}
				property="outlineColor"
				label="Outline Color"
			>
				{(elementProp, setValue) => <FieldTextOutlineColorInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<FormPropertyField
				controlId={controlId}
				elementProps={elementProps}
				localVariablesStore={localVariablesStore}
				property="halign"
				label="Horizontal Alignment"
			>
				{(elementProp, setValue) => <FieldTextHorizontalAlignmentInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<FormPropertyField
				controlId={controlId}
				elementProps={elementProps}
				localVariablesStore={localVariablesStore}
				property="valign"
				label="Vertical Alignment"
			>
				{(elementProp, setValue) => <FieldTextVerticalAlignmentInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>
		</>
	)
})
const textInputFeatures: InputFeatureIconsProps = {
	variables: true,
	local: true,
}

const FieldTextLabel = observer(function FieldTextLabel({ elementProps }: { elementProps: ButtonGraphicsTextElement }) {
	if (elementProps.text.isExpression) {
		return (
			<InlineHelp help="You can read more about expressions in the Getting Started pages">
				Button text expression
				<InputFeatureIcons {...textInputFeatures} />
			</InlineHelp>
		)
	} else {
		return (
			<InlineHelp help="The text you see on the button you're working with. You can use variables, but not expressions.">
				Button text string
				<InputFeatureIcons {...textInputFeatures} />
			</InlineHelp>
		)
	}
})

interface FieldTextInputProps extends InputFieldCommonProps<ButtonGraphicsTextElement, 'text'> {
	localVariablesStore: LocalVariablesStore
}

const FieldTextInput = observer(function FieldTextInput({
	elementProp,
	setValue,
	localVariablesStore,
}: FieldTextInputProps) {
	return (
		<TextInputField
			tooltip={'Button text'}
			setValue={setValue}
			value={elementProp.value ?? ''}
			useVariables
			localVariables={localVariablesStore.getOptions(null, false, true)}
			isExpression={false}
		/>
	)
})

const FONT_SIZES: DropdownChoice[] = [
	{ id: 'auto', label: 'Auto' },
	{ id: '10', label: '10%' },
	{ id: '15', label: '15%' },
	{ id: '25', label: '25%' },
	{ id: '33', label: '33%' },
	{ id: '50', label: '50%' },
	{ id: '100', label: '100%' },
]

const FieldFontSizeInput = observer(function FieldFontSizeInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsTextElement, 'fontsize'>) {
	return (
		<DropdownInputField
			choices={FONT_SIZES}
			setValue={setValue as (value: DropdownChoiceId) => void}
			value={elementProp.value}
			allowCustom={true}
			disableEditingCustom={true}
			regex={'/^0*(?:[3-9]|[1-9][0-9]|1[0-9]{2}|200)?$/i'}
		/>
	)
})

const FieldTextColorInput = observer(function FieldTextColorInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsTextElement, 'color'>) {
	return (
		<ColorInputField
			setValue={setValue as (color: number | string) => void}
			value={elementProp.value}
			returnType="number"
			helpText="Font color"
		/>
	)
})

const FieldTextOutlineColorInput = observer(function FieldTextOutlineColorInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsTextElement, 'outlineColor'>) {
	return (
		<ColorInputField
			setValue={setValue as (color: number | string) => void}
			value={elementProp.value}
			returnType="number"
			helpText="Outline color"
			enableAlpha
		/>
	)
})

const FieldTextHorizontalAlignmentInput = observer(function FieldTextHorizontalAlignmentInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsTextElement, 'halign'>) {
	return <HorizontalAlignmentInputField setValue={setValue} value={elementProp.value} />
})

const FieldTextVerticalAlignmentInput = observer(function FieldTextVerticalAlignmentInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsTextElement, 'valign'>) {
	return <VerticalAlignmentInputField setValue={setValue} value={elementProp.value} />
})
