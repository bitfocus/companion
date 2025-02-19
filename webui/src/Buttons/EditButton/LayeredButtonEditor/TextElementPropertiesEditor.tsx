import { ButtonGraphicsTextElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { CFormLabel, CCol, CInputGroup, CButton } from '@coreui/react'
import { faDollarSign, faFont } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import React, { useCallback } from 'react'
import { InlineHelp } from '../../../Components/InlineHelp.js'
import { TextInputField } from '../../../Components/TextInputField.js'
import { InputFeatureIcons, InputFeatureIconsProps } from '../../../Controls/OptionsInputField.js'
import { ControlLocalVariables } from '../../../LocalVariableDefinitions.js'
import { DropdownInputField } from '../../../Components/DropdownInputField.js'
import { useElementIsExpressionMutatorCallback, useElementMutatorCallback } from './StyleStore.js'
import { FONT_SIZES } from '../../../Constants.js'
import { DropdownChoiceId } from '@companion-module/base'
import { ColorInputField } from '../../../Components/ColorInputField.js'
import { AlignmentInputField } from '../../../Components/AlignmentInputField.js'

export const TextElementPropertiesEditor = observer(function TextElementPropertiesEditor({
	controlId,
	elementProps,
}: {
	controlId: string
	elementProps: Readonly<ButtonGraphicsTextElement>
}) {
	return (
		<>
			<CFormLabel htmlFor="inputText" className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				<FieldTextLabel elementProps={elementProps} />
			</CFormLabel>
			<CCol sm={8}>
				<FieldTextInput controlId={controlId} elementProps={elementProps} />
			</CCol>

			<CFormLabel htmlFor="inputFontSize" className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				Font Size
			</CFormLabel>
			<CCol sm={8}>
				<FieldFontSizeInput controlId={controlId} elementProps={elementProps} />
			</CCol>

			<CFormLabel htmlFor="inputColor" className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				Color
			</CFormLabel>
			<CCol sm={8}>
				<FieldTextColorInput controlId={controlId} elementProps={elementProps} />
			</CCol>

			<CFormLabel htmlFor="inputAlignment" className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				Alignment
			</CFormLabel>
			<CCol sm={8}>
				<FieldTextAlignmentInput controlId={controlId} elementProps={elementProps} />
			</CCol>
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
	controlId,
	elementProps,
}: {
	controlId: string
	elementProps: ButtonGraphicsTextElement
}) {
	const setTextValue = useElementMutatorCallback<ButtonGraphicsTextElement, 'text'>(controlId, elementProps.id, 'text')
	const setIsExpression = useElementIsExpressionMutatorCallback<ButtonGraphicsTextElement, 'text'>(
		controlId,
		elementProps.id,
		'text'
	)
	const toggleExpression = useCallback(() => {
		setIsExpression(!elementProps.text.isExpression)
	}, [setIsExpression, elementProps])

	return (
		<CInputGroup>
			<TextInputField
				tooltip={'Button text'}
				setValue={setTextValue}
				value={elementProps.text.value ?? ''}
				useVariables
				localVariables={ControlLocalVariables}
				isExpression={elementProps.text.isExpression}
				style={{ fontWeight: 'bold', fontSize: 18 }}
			/>
			<CButton
				color="info"
				variant="outline"
				onClick={toggleExpression}
				title={elementProps.text.isExpression ? 'Expression mode ' : 'String mode'}
			>
				<FontAwesomeIcon icon={elementProps.text.isExpression ? faDollarSign : faFont} />
			</CButton>
		</CInputGroup>
	)
})

const FieldFontSizeInput = observer(function FieldFontSizeInput({
	controlId,
	elementProps,
}: {
	controlId: string
	elementProps: ButtonGraphicsTextElement
}) {
	const setSizeValue = useElementMutatorCallback<ButtonGraphicsTextElement, 'fontsize'>(
		controlId,
		elementProps.id,
		'fontsize'
	)

	if (elementProps.fontsize.isExpression) {
		return <p>TODO</p>
	} else {
		return (
			<DropdownInputField
				choices={FONT_SIZES}
				setValue={setSizeValue as (value: DropdownChoiceId) => void}
				value={elementProps.fontsize.value}
				allowCustom={true}
				disableEditingCustom={true}
				regex={'/^0*(?:[3-9]|[1-9][0-9]|1[0-9]{2}|200)\\s?(?:pt|px)?$/i'}
			/>
		)
	}
})

const FieldTextColorInput = observer(function FieldTextColorInput({
	controlId,
	elementProps,
}: {
	controlId: string
	elementProps: ButtonGraphicsTextElement
}) {
	const setColor = useElementMutatorCallback<ButtonGraphicsTextElement, 'color'>(controlId, elementProps.id, 'color')

	if (elementProps.color.isExpression) {
		return <p>TODO</p>
	} else {
		return (
			<ColorInputField
				setValue={setColor as (color: number | string) => void}
				value={elementProps.color.value}
				returnType="number"
				helpText="Font color"
			/>
		)
	}
})

const FieldTextAlignmentInput = observer(function FieldTextAlignmentInput({
	controlId,
	elementProps,
}: {
	controlId: string
	elementProps: ButtonGraphicsTextElement
}) {
	const setAlignmentValue = useElementMutatorCallback<ButtonGraphicsTextElement, 'alignment'>(
		controlId,
		elementProps.id,
		'alignment'
	)
	if (elementProps.alignment.isExpression) {
		return <p>TODO</p>
	} else {
		return <AlignmentInputField setValue={setAlignmentValue} value={elementProps.alignment.value} />
	}
})
