import {
	ButtonGraphicsCanvasLayer,
	ButtonGraphicsDecorationType,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { CFormLabel, CCol } from '@coreui/react'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { DropdownInputField } from '../../../Components/DropdownInputField.js'
import { useLayerMutatorCallback } from './StyleStore.js'
import { DropdownChoice, DropdownChoiceId } from '@companion-module/base'
import { ColorInputField } from '../../../Components/ColorInputField.js'

export const CanvasLayerPropertiesEditor = observer(function CanvasLayerPropertiesEditor({
	controlId,
	layerProps,
}: {
	controlId: string
	layerProps: Readonly<ButtonGraphicsCanvasLayer>
}) {
	return (
		<>
			<CFormLabel htmlFor="inputColor" className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				Color
			</CFormLabel>
			<CCol sm={8}>
				<FieldFillColorInput controlId={controlId} layerProps={layerProps} />
			</CCol>

			<CFormLabel htmlFor="inputDecoration" className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				Decoration
			</CFormLabel>
			<CCol sm={8}>
				<FieldDecorationInput controlId={controlId} layerProps={layerProps} />
			</CCol>
		</>
	)
})

const FieldFillColorInput = observer(function FieldFillColorInput({
	controlId,
	layerProps,
}: {
	controlId: string
	layerProps: ButtonGraphicsCanvasLayer
}) {
	const setColor = useLayerMutatorCallback<ButtonGraphicsCanvasLayer, 'color'>(controlId, layerProps.id, 'color')

	return (
		<ColorInputField
			setValue={setColor as (color: number | string) => void}
			value={layerProps.color ?? 0}
			returnType="number"
			helpText="Background color"
		/>
	)
})

const FieldDecorationInput = observer(function FieldDecorationInput({
	controlId,
	layerProps,
}: {
	controlId: string
	layerProps: ButtonGraphicsCanvasLayer
}) {
	const setDecoration = useLayerMutatorCallback<ButtonGraphicsCanvasLayer, 'decoration'>(
		controlId,
		layerProps.id,
		'decoration'
	)

	return (
		<DropdownInputField
			choices={DecorationChoices}
			setValue={setDecoration as (value: DropdownChoiceId) => void}
			value={layerProps.decoration}
		/>
	)
})

const DecorationChoices: DropdownChoice[] = [
	{ id: ButtonGraphicsDecorationType.FollowDefault, label: 'Follow default' },
	{ id: ButtonGraphicsDecorationType.TopBar, label: 'Top bar' },
	{ id: ButtonGraphicsDecorationType.Border, label: 'Border when pressed' },
]
