import { ButtonGraphicsTextLayer } from '@companion-app/shared/Model/StyleLayersModel.js'
import { CForm, CFormLabel, CCol, CInputGroup, CButton } from '@coreui/react'
import { faDollarSign, faFont } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import React, { useCallback } from 'react'
import { InlineHelp } from '../../../Components/InlineHelp.js'
import { TextInputField } from '../../../Components/TextInputField.js'
import { InputFeatureIcons, InputFeatureIconsProps } from '../../../Controls/OptionsInputField.js'
import { ControlLocalVariables } from '../../../LocalVariableDefinitions.js'
import { PreventDefaultHandler } from '../../../util.js'
import { DropdownInputField } from '../../../Components/DropdownInputField.js'
import { useLayerMutatorCallback } from './StyleStore.js'
import { FONT_SIZES } from '../../../Constants.js'
import { DropdownChoiceId } from '@companion-module/base'
import { ColorInputField } from '../../../Components/ColorInputField.js'
import { AlignmentInputField } from '../../../Components/AlignmentInputField.js'

export const TextLayerPropertiesEditor = observer(function TextLayerPropertiesEditor({
	controlId,
	layerProps,
}: {
	controlId: string
	layerProps: Readonly<ButtonGraphicsTextLayer>
}) {
	return (
		<CForm className="row g-2" onSubmit={PreventDefaultHandler}>
			<CCol sm={12}>// TODO - common properties</CCol>
			<CFormLabel htmlFor="inputText" className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				<FieldTextLabel layerProps={layerProps} />
			</CFormLabel>
			<CCol sm={8}>
				<FieldTextInput controlId={controlId} layerProps={layerProps} />
			</CCol>
			<CFormLabel htmlFor="inputFontSize" className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				Font Size
			</CFormLabel>
			<CCol sm={8}>
				<FieldFontSizeInput controlId={controlId} layerProps={layerProps} />
			</CCol>
			<CFormLabel htmlFor="inputColor" className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				Color
			</CFormLabel>
			<CCol sm={8}>
				<FieldTextColorInput controlId={controlId} layerProps={layerProps} />
			</CCol>
			<CFormLabel htmlFor="inputAlignment" className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				Alignment
			</CFormLabel>
			<CCol sm={8}>
				<FieldTextAlignmentInput controlId={controlId} layerProps={layerProps} />
			</CCol>
		</CForm>
	)
})
const textInputFeatures: InputFeatureIconsProps = {
	variables: true,
	local: true,
}

const FieldTextLabel = observer(function FieldTextLabel({ layerProps }: { layerProps: ButtonGraphicsTextLayer }) {
	if (layerProps.isExpression) {
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
	layerProps,
}: {
	controlId: string
	layerProps: ButtonGraphicsTextLayer
}) {
	const setTextValue = useLayerMutatorCallback<ButtonGraphicsTextLayer, 'text'>(controlId, layerProps.id, 'text')
	const setIsExpression = useLayerMutatorCallback<ButtonGraphicsTextLayer, 'isExpression'>(
		controlId,
		layerProps.id,
		'isExpression'
	)
	const toggleExpression = useCallback(() => {
		setIsExpression(!layerProps.isExpression)
	}, [setIsExpression, layerProps])

	return (
		<CInputGroup>
			<TextInputField
				tooltip={'Button text'}
				setValue={setTextValue}
				value={layerProps.text ?? ''}
				useVariables
				localVariables={ControlLocalVariables}
				isExpression={layerProps.isExpression}
				style={{ fontWeight: 'bold', fontSize: 18 }}
			/>
			<CButton
				color="info"
				variant="outline"
				onClick={toggleExpression}
				title={layerProps.isExpression ? 'Expression mode ' : 'String mode'}
			>
				<FontAwesomeIcon icon={layerProps.isExpression ? faDollarSign : faFont} />
			</CButton>
		</CInputGroup>
	)
})

const FieldFontSizeInput = observer(function FieldFontSizeInput({
	controlId,
	layerProps,
}: {
	controlId: string
	layerProps: ButtonGraphicsTextLayer
}) {
	const setSizeValue = useLayerMutatorCallback<ButtonGraphicsTextLayer, 'fontsize'>(
		controlId,
		layerProps.id,
		'fontsize'
	)

	return (
		<DropdownInputField
			choices={FONT_SIZES}
			setValue={setSizeValue as (value: DropdownChoiceId) => void}
			value={layerProps.fontsize ?? 'auto'}
			allowCustom={true}
			disableEditingCustom={true}
			regex={'/^0*(?:[3-9]|[1-9][0-9]|1[0-9]{2}|200)\\s?(?:pt|px)?$/i'}
		/>
	)
})

const FieldTextColorInput = observer(function FieldTextColorInput({
	controlId,
	layerProps,
}: {
	controlId: string
	layerProps: ButtonGraphicsTextLayer
}) {
	const setColor = useLayerMutatorCallback<ButtonGraphicsTextLayer, 'color'>(controlId, layerProps.id, 'color')

	return (
		<ColorInputField
			setValue={setColor as (color: number | string) => void}
			value={layerProps.color ?? 0}
			returnType="number"
			helpText="Font color"
		/>
	)
})

const FieldTextAlignmentInput = observer(function FieldTextAlignmentInput({
	controlId,
	layerProps,
}: {
	controlId: string
	layerProps: ButtonGraphicsTextLayer
}) {
	const setAlignmentValue = useLayerMutatorCallback<ButtonGraphicsTextLayer, 'alignment'>(
		controlId,
		layerProps.id,
		'alignment'
	)

	return <AlignmentInputField setValue={setAlignmentValue} value={layerProps.alignment ?? 'center:center'} />
})
