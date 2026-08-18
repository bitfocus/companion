import React, { useId } from 'react'
import { isLabelValid } from '@companion-app/shared/Label.js'
import { StaticAlert } from '~/Components/Alert'
import { FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'

interface ImageNameInputProps {
	value: string
	onChange: (value: string) => void
	disabled?: boolean
	placeholder?: string
	helpText?: string | React.ReactNode
	showWarning?: boolean
	warningText?: string | React.ReactNode
	errorMessage?: string | null
	className?: string
}

export function ImageNameInput({
	value,
	onChange,
	disabled = false,
	placeholder = 'Enter image name...',
	helpText,
	showWarning = false,
	warningText,
	errorMessage,
	className,
}: ImageNameInputProps): React.JSX.Element {
	// Generate tooltip based on validation state
	const tooltip = !isLabelValid(value) ? 'Invalid name: Use only letters, numbers, hyphens, and underscores' : undefined

	const defaultHelpText = (
		<>
			The image name is used to reference this image in button configurations and other places.
			<br />
			It must contain only letters, numbers, hyphens, and underscores.
		</>
	)

	const labelInputId = useId()

	return (
		<>
			{errorMessage && (
				<StaticAlert color="danger" className="mb-4">
					{errorMessage}
				</StaticAlert>
			)}

			{showWarning && warningText && (
				<StaticAlert color="warning" className="mb-4">
					{warningText}
				</StaticAlert>
			)}

			<Grid.Row className={className}>
				<FormLabel htmlFor={labelInputId} sm={3} column>
					Image name
				</FormLabel>
				<Grid.Col sm={9}>
					<TextInputFieldSimple
						id={labelInputId}
						value={value}
						setValue={onChange}
						placeholder={placeholder}
						tooltip={tooltip}
						checkValid={isLabelValid}
						disabled={disabled}
						immediateValue
					/>
				</Grid.Col>
				<Grid.Col sm={12} className="mt-2 text-muted small">
					{helpText || defaultHelpText}
				</Grid.Col>
			</Grid.Row>
		</>
	)
}
