import {
	ButtonGraphicsCanvasElement,
	ButtonGraphicsDecorationType,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { CFormLabel, CCol } from '@coreui/react'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { DropdownInputField } from '../../../Components/DropdownInputField.js'
import { useElementMutatorCallback } from './StyleStore.js'
import { DropdownChoice, DropdownChoiceId } from '@companion-module/base'
import { ColorInputField } from '../../../Components/ColorInputField.js'

export const CanvasElementPropertiesEditor = observer(function CanvasElementPropertiesEditor({
	controlId,
	elementProps,
}: {
	controlId: string
	elementProps: Readonly<ButtonGraphicsCanvasElement>
}) {
	return (
		<>
			<CFormLabel htmlFor="inputColor" className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				Color
			</CFormLabel>
			<CCol sm={8}>
				<FieldFillColorInput controlId={controlId} elementProps={elementProps} />
			</CCol>

			<CFormLabel htmlFor="inputDecoration" className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				Decoration
			</CFormLabel>
			<CCol sm={8}>
				<FieldDecorationInput controlId={controlId} elementProps={elementProps} />
			</CCol>
		</>
	)
})

const FieldFillColorInput = observer(function FieldFillColorInput({
	controlId,
	elementProps,
}: {
	controlId: string
	elementProps: ButtonGraphicsCanvasElement
}) {
	const setColor = useElementMutatorCallback<ButtonGraphicsCanvasElement, 'color'>(controlId, elementProps.id, 'color')

	if (elementProps.color.isExpression) {
		return <p>TODO</p>
	} else {
		return (
			<ColorInputField
				setValue={setColor as (color: number | string) => void}
				value={elementProps.color.value}
				returnType="number"
				helpText="Background color"
			/>
		)
	}
})

const FieldDecorationInput = observer(function FieldDecorationInput({
	controlId,
	elementProps,
}: {
	controlId: string
	elementProps: ButtonGraphicsCanvasElement
}) {
	const setDecoration = useElementMutatorCallback<ButtonGraphicsCanvasElement, 'decoration'>(
		controlId,
		elementProps.id,
		'decoration'
	)

	if (elementProps.decoration.isExpression) {
		return <p>TODO</p>
	} else {
		return (
			<DropdownInputField
				choices={DecorationChoices}
				setValue={setDecoration as (value: DropdownChoiceId) => void}
				value={elementProps.decoration.value}
			/>
		)
	}
})

const DecorationChoices: DropdownChoice[] = [
	{ id: ButtonGraphicsDecorationType.FollowDefault, label: 'Follow default' },
	{ id: ButtonGraphicsDecorationType.TopBar, label: 'Top bar' },
	{ id: ButtonGraphicsDecorationType.Border, label: 'Border when pressed' },
]
