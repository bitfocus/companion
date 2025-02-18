import { ButtonGraphicsImageLayer } from '@companion-app/shared/Model/StyleLayersModel.js'
import { CForm, CFormLabel, CCol, CButtonGroup, CButton, CAlert } from '@coreui/react'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useState } from 'react'
import { PreventDefaultHandler } from '../../../util.js'
import { useLayerMutatorCallback } from './StyleStore.js'
import { AlignmentInputField } from '../../../Components/AlignmentInputField.js'
import { PNGInputField } from '../../../Components/PNGInputField.js'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export const ImageLayerPropertiesEditor = observer(function ImageLayerPropertiesEditor({
	controlId,
	layerProps,
}: {
	controlId: string
	layerProps: Readonly<ButtonGraphicsImageLayer>
}) {
	return (
		<CForm className="row g-2" onSubmit={PreventDefaultHandler}>
			<CCol sm={12}>// TODO - common properties</CCol>

			<CFormLabel htmlFor="inputImage" className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				Image
			</CFormLabel>
			<CCol sm={8}>
				<FieldImagePickerInput controlId={controlId} layerProps={layerProps} />
			</CCol>

			<CFormLabel htmlFor="inputAlignment" className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				Alignment
			</CFormLabel>
			<CCol sm={8}>
				<FieldImageAlignmentInput controlId={controlId} layerProps={layerProps} />
			</CCol>
		</CForm>
	)
})

const FieldImagePickerInput = observer(function FieldImagePickerInput({
	controlId,
	layerProps,
}: {
	controlId: string
	layerProps: ButtonGraphicsImageLayer
}) {
	const setImageData = useLayerMutatorCallback<ButtonGraphicsImageLayer, 'base64Image'>(
		controlId,
		layerProps.id,
		'base64Image'
	)

	const [pngError, setPngError] = useState<string | null>(null)
	const setImageDataAndClearError = useCallback(
		(data: string | null) => {
			setPngError(null)
			setImageData(data)
		},
		[setImageData]
	)
	const clearPng = useCallback(() => {
		setPngError(null)
		setImageData(null)
	}, [setImageData])

	return (
		<>
			<CButtonGroup className="png-browse">
				<PNGInputField
					onSelect={setImageDataAndClearError}
					onError={setPngError}
					min={{ width: 8, height: 8 }}
					max={{ width: 400, height: 400 }}
				/>
				{clearPng && (
					<CButton color="danger" disabled={!layerProps.base64Image} onClick={clearPng}>
						<FontAwesomeIcon icon={faTrash} />
					</CButton>
				)}
			</CButtonGroup>
			{pngError && (
				<CAlert color="warning" dismissible>
					{pngError}
				</CAlert>
			)}
		</>
	)
})

const FieldImageAlignmentInput = observer(function FieldImageAlignmentInput({
	controlId,
	layerProps,
}: {
	controlId: string
	layerProps: ButtonGraphicsImageLayer
}) {
	const setAlignmentValue = useLayerMutatorCallback<ButtonGraphicsImageLayer, 'alignment'>(
		controlId,
		layerProps.id,
		'alignment'
	)

	return <AlignmentInputField setValue={setAlignmentValue} value={layerProps.alignment ?? 'center:center'} />
})
