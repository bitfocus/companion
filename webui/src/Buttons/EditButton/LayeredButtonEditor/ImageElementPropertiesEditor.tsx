import { ButtonGraphicsImageElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { CFormLabel, CCol, CButtonGroup, CButton, CAlert } from '@coreui/react'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useState } from 'react'
import { useElementMutatorCallback } from './StyleStore.js'
import { AlignmentInputField } from '../../../Components/AlignmentInputField.js'
import { PNGInputField } from '../../../Components/PNGInputField.js'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export const ImageElementPropertiesEditor = observer(function ImageElementPropertiesEditor({
	controlId,
	elementProps,
}: {
	controlId: string
	elementProps: Readonly<ButtonGraphicsImageElement>
}) {
	return (
		<>
			<CFormLabel htmlFor="inputImage" className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				Image
			</CFormLabel>
			<CCol sm={8}>
				<FieldImagePickerInput controlId={controlId} elementProps={elementProps} />
			</CCol>

			<CFormLabel htmlFor="inputAlignment" className={classNames('col-sm-4 col-form-label col-form-label-sm')}>
				Alignment
			</CFormLabel>
			<CCol sm={8}>
				<FieldImageAlignmentInput controlId={controlId} elementProps={elementProps} />
			</CCol>
		</>
	)
})

const FieldImagePickerInput = observer(function FieldImagePickerInput({
	controlId,
	elementProps,
}: {
	controlId: string
	elementProps: ButtonGraphicsImageElement
}) {
	const setImageData = useElementMutatorCallback<ButtonGraphicsImageElement, 'base64Image'>(
		controlId,
		elementProps.id,
		'base64Image'
	)

	const [imageLoadError, setImageLoadError] = useState<string | null>(null)
	const setImageDataAndClearError = useCallback(
		(data: string | null) => {
			setImageLoadError(null)
			setImageData(data)
		},
		[setImageData]
	)
	const clearImage = useCallback(() => {
		setImageLoadError(null)
		setImageData(null)
	}, [setImageData])

	return (
		<>
			<CButtonGroup className="png-browse">
				<PNGInputField
					onSelect={setImageDataAndClearError}
					onError={setImageLoadError}
					min={{ width: 8, height: 8 }}
					max={{ width: 400, height: 400 }}
					allowNonPng
				/>
				{clearImage && (
					<CButton color="danger" disabled={!elementProps.base64Image} onClick={clearImage}>
						<FontAwesomeIcon icon={faTrash} />
					</CButton>
				)}
			</CButtonGroup>
			{imageLoadError && (
				<CAlert color="warning" dismissible>
					{imageLoadError}
				</CAlert>
			)}
		</>
	)
})

const FieldImageAlignmentInput = observer(function FieldImageAlignmentInput({
	controlId,
	elementProps,
}: {
	controlId: string
	elementProps: ButtonGraphicsImageElement
}) {
	const setAlignmentValue = useElementMutatorCallback<ButtonGraphicsImageElement, 'alignment'>(
		controlId,
		elementProps.id,
		'alignment'
	)

	return <AlignmentInputField setValue={setAlignmentValue} value={elementProps.alignment ?? 'center:center'} />
})
