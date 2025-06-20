import React from 'react'
import { CFormLabel, CAlert } from '@coreui/react'
import { isLabelValid } from '@companion-app/shared/Label.js'
import { TextInputField } from '~/Components/TextInputField.js'

interface ImageIdInputProps {
	value: string
	onChange: (value: string) => void
	disabled?: boolean
	placeholder?: string
	helpText?: string | React.ReactNode
	showWarning?: boolean
	warningText?: string | React.ReactNode
	errorMessage?: string | null
}

export function ImageIdInput({
	value,
	onChange,
	disabled = false,
	placeholder = 'Enter image ID...',
	helpText,
	showWarning = false,
	warningText,
	errorMessage,
}: ImageIdInputProps): JSX.Element {
	// Generate tooltip based on validation state
	const tooltip = !isLabelValid(value) ? 'Invalid ID: Use only letters, numbers, hyphens, and underscores' : undefined

	const defaultHelpText = (
		<>
			The image ID is used to reference this image in button configurations and other places.
			<br />
			It must contain only letters, numbers, hyphens, and underscores.
		</>
	)

	return (
		<>
			{errorMessage && (
				<CAlert color="danger" className="mb-3">
					{errorMessage}
				</CAlert>
			)}

			{showWarning && warningText && (
				<CAlert color="warning" className="mb-3">
					{warningText}
				</CAlert>
			)}

			<div className="mb-3 row">
				<CFormLabel htmlFor="imageIdInput" className="col-sm-3 col-form-label">
					Image ID
				</CFormLabel>
				<div className="col-sm-9">
					<TextInputField
						value={value}
						setValue={onChange}
						placeholder={placeholder}
						tooltip={tooltip}
						checkValid={isLabelValid}
						disabled={disabled}
					/>
				</div>
			</div>
			<div className="text-muted small">{helpText || defaultHelpText}</div>
		</>
	)
}
