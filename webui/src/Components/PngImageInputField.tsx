import React, { useCallback, useState } from 'react'
import { CAlert, CButton, CButtonGroup } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { PNGInputField } from './PNGInputField.js'

interface PngImageInputFieldProps {
	value: string | null
	setValue: (value: string | null) => void
	disabled?: boolean
	min?: { width: number; height: number }
	max?: { width: number; height: number }
	allowNonPng?: boolean
}

export function PngImageInputField({
	value,
	setValue,
	disabled,
	min = { width: 8, height: 8 },
	max = { width: 400, height: 400 },
	allowNonPng = true,
}: PngImageInputFieldProps): React.JSX.Element {
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
					min={min}
					max={max}
					allowNonPng={allowNonPng}
				/>
				<CButton color="danger" disabled={disabled || !value} onClick={clearImage}>
					<FontAwesomeIcon icon={faTrash} />
				</CButton>
			</CButtonGroup>
			{imageLoadError && (
				<CAlert color="warning" dismissible>
					{imageLoadError}
				</CAlert>
			)}
		</>
	)
}
