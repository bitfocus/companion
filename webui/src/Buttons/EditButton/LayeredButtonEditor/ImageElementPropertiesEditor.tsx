import { ButtonGraphicsImageElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { CButtonGroup, CButton, CAlert } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useState } from 'react'
import { AlignmentInputField } from '../../../Components/AlignmentInputField.js'
import { PNGInputField } from '../../../Components/PNGInputField.js'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FormPropertyField, InputFieldCommonProps } from './ElementPropertiesUtil.js'
import { CompanionAlignment } from '@companion-module/base'

export const ImageElementPropertiesEditor = observer(function ImageElementPropertiesEditor({
	controlId,
	elementProps,
}: {
	controlId: string
	elementProps: Readonly<ButtonGraphicsImageElement>
}) {
	return (
		<>
			<FormPropertyField controlId={controlId} elementProps={elementProps} property="base64Image" label="Image">
				{(elementProp, setValue) => <FieldImagePickerInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<FormPropertyField controlId={controlId} elementProps={elementProps} property="alignment" label="Alignment">
				{(elementProp, setValue) => <FieldImageAlignmentInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>
		</>
	)
})

const FieldImagePickerInput = observer(function FieldImagePickerInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsImageElement, 'base64Image'>) {
	const [imageLoadError, setImageLoadError] = useState<string | null>(null)
	const setImageDataAndClearError = useCallback(
		(data: string | null) => {
			setImageLoadError(null)
			setValue(data)
		},
		[setValue]
	)
	const clearImage = useCallback(() => {
		setImageLoadError(null)
		setValue(null)
	}, [setValue])

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
					<CButton color="danger" disabled={!elementProp} onClick={clearImage}>
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
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsImageElement, 'alignment'>) {
	return <AlignmentInputField setValue={setValue} value={elementProp.value as CompanionAlignment} />
})
