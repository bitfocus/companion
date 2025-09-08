import { ButtonGraphicsImageElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { CButtonGroup, CButton, CAlert } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useState } from 'react'
import { PNGInputField } from '~/Components/PNGInputField.js'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FormPropertyField, InputFieldCommonProps } from './ElementPropertiesUtil.js'

export const ImageElementPropertiesEditor = observer(function ImageElementPropertiesEditor({
	elementProps,
}: {
	elementProps: Readonly<ButtonGraphicsImageElement>
}) {
	return (
		<>
			<FormPropertyField elementProps={elementProps} property="base64Image" label="Image">
				{(elementProp, setValue) => <FieldImagePickerInput elementProp={elementProp} setValue={setValue} />}
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
