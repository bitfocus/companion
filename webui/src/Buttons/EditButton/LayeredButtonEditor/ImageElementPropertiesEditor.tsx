import { ButtonGraphicsImageElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { CButtonGroup, CButton, CAlert } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useState } from 'react'
import { HorizontalAlignmentInputField, VerticalAlignmentInputField } from '~/Components/AlignmentInputField.js'
import { PNGInputField } from '~/Components/PNGInputField.js'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FormPropertyField, InputFieldCommonProps } from './ElementPropertiesUtil.js'
import { DropdownChoice, DropdownChoiceId } from '@companion-module/base'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { ElementBoundsProperties } from './ElementBoundsProperties.js'

export const ImageElementPropertiesEditor = observer(function ImageElementPropertiesEditor({
	elementProps,
}: {
	elementProps: Readonly<ButtonGraphicsImageElement>
}) {
	return (
		<>
			<ElementBoundsProperties elementProps={elementProps} />

			<FormPropertyField elementProps={elementProps} property="base64Image" label="Image">
				{(elementProp, setValue) => <FieldImagePickerInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<FormPropertyField elementProps={elementProps} property="halign" label="Horizontal Alignment">
				{(elementProp, setValue) => (
					<FieldImageHorizontalAlignmentInput elementProp={elementProp} setValue={setValue} />
				)}
			</FormPropertyField>

			<FormPropertyField elementProps={elementProps} property="valign" label="Vertical Alignment">
				{(elementProp, setValue) => <FieldImageVerticalAlignmentInput elementProp={elementProp} setValue={setValue} />}
			</FormPropertyField>

			<FormPropertyField elementProps={elementProps} property="fillMode" label="Fill Mode">
				{(elementProp, setValue) => <FieldImageFillModeInput elementProp={elementProp} setValue={setValue} />}
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

const FieldImageHorizontalAlignmentInput = observer(function FieldImageHorizontalAlignmentInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsImageElement, 'halign'>) {
	return <HorizontalAlignmentInputField setValue={setValue} value={elementProp.value} />
})

const FieldImageVerticalAlignmentInput = observer(function FieldImageVerticalAlignmentInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsImageElement, 'valign'>) {
	return <VerticalAlignmentInputField setValue={setValue} value={elementProp.value} />
})

const FieldImageFillModeInput = observer(function FieldImageFillModeInput({
	elementProp,
	setValue,
}: InputFieldCommonProps<ButtonGraphicsImageElement, 'fillMode'>) {
	return (
		<DropdownInputField
			choices={FillModeChoices}
			setValue={setValue as (value: DropdownChoiceId) => void}
			value={elementProp.value}
		/>
	)
})

const FillModeChoices: DropdownChoice[] = [
	{ id: 'fit_or_shrink', label: 'Fit or Shrink' },
	{ id: 'fit', label: 'Fit' },
	{ id: 'fill', label: 'Fill' },
	{ id: 'crop', label: 'Crop' },
]
