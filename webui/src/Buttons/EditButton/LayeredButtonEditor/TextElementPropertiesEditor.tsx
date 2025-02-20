import { ButtonGraphicsTextElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { InlineHelp } from '../../../Components/InlineHelp.js'
import { TextInputField } from '../../../Components/TextInputField.js'
import { InputFeatureIcons, InputFeatureIconsProps } from '../../../Controls/OptionsInputField.js'
import { ControlLocalVariables } from '../../../LocalVariableDefinitions.js'
import { DropdownInputField } from '../../../Components/DropdownInputField.js'
import { FONT_SIZES } from '../../../Constants.js'
import { CompanionAlignment, DropdownChoiceId } from '@companion-module/base'
import { ColorInputField } from '../../../Components/ColorInputField.js'
import { AlignmentInputField } from '../../../Components/AlignmentInputField.js'
import { FormPropertyField, InputFieldCommonProps } from './ElementPropertiesUtil.js'

export const TextElementPropertiesEditor = observer(function TextElementPropertiesEditor({
	controlId,
	elementProps,
}: {
	controlId: string
	elementProps: Readonly<ButtonGraphicsTextElement>
}) {
	return (
		<>
			<FormPropertyField
				controlId={controlId}
				elementProps={elementProps}
				property="text"
				label={<FieldTextLabel elementProps={elementProps} />}
			>
				{(elementProp, setValue) => <FieldTextInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<FormPropertyField controlId={controlId} elementProps={elementProps} property="fontsize" label="Font Size">
				{(elementProp, setValue) => <FieldFontSizeInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<FormPropertyField controlId={controlId} elementProps={elementProps} property="color" label="Color">
				{(elementProp, setValue) => <FieldTextColorInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<FormPropertyField controlId={controlId} elementProps={elementProps} property="alignment" label="Alignment">
				{(elementProp, setValue) => <FieldTextAlignmentInput elementProp={elementProp} setValue={setValue} />}
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

const FieldTextInput = observer(function FieldTextInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsTextElement, 'text'>) {
	return (
		<TextInputField
			tooltip={'Button text'}
			setValue={setValue}
			value={elementProp.value ?? ''}
			useVariables
			localVariables={ControlLocalVariables}
			isExpression={false}
		/>
	)
})

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
			regex={'/^0*(?:[3-9]|[1-9][0-9]|1[0-9]{2}|200)\\s?(?:pt|px)?$/i'}
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

const FieldTextAlignmentInput = observer(function FieldTextAlignmentInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsTextElement, 'alignment'>) {
	return <AlignmentInputField setValue={setValue} value={elementProp.value as CompanionAlignment} />
})
