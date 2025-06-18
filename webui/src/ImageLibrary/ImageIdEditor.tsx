import React, { useCallback, useContext, useState, useEffect } from 'react'
import { SocketContext } from '~/util.js'
import { observer } from 'mobx-react-lite'
import { isLabelValid } from '@companion-app/shared/Label.js'
import { TextInputField } from '~/Components/TextInputField.js'

interface ImageIdEditorProps {
	imageId: string
	currentId: string
}

export const ImageIdEditor = observer(function ImageIdEditor({ imageId, currentId }: ImageIdEditorProps) {
	const socket = useContext(SocketContext)
	const [localValue, setLocalValue] = useState(currentId)
	const [isDuplicate, setIsDuplicate] = useState(false)
	const [isUpdating, setIsUpdating] = useState(false)

	const checkValid = useCallback(
		(value: string): boolean => {
			// Check if it's a valid label format
			if (!isLabelValid(value)) {
				return false
			}

			// Check if it's a duplicate (when we know there's a duplicate error)
			if (isDuplicate && value === localValue) {
				return false
			}

			return true
		},
		[isDuplicate, localValue]
	)

	const handleIdChange = useCallback(
		(newValue: string) => {
			setLocalValue(newValue)
			setIsDuplicate(false) // Reset duplicate flag when value changes

			// Only attempt to update if the value is valid and different from current
			if (isLabelValid(newValue) && newValue !== currentId && newValue.trim() !== '') {
				setIsUpdating(true)
				socket
					.emitPromise('image-library:set-id', [imageId, newValue])
					.then((result) => {
						// Server returns the sanitized ID on success
						if (typeof result === 'string') {
							setLocalValue(result)
							setIsDuplicate(false)
						}
					})
					.catch((err) => {
						console.error('Failed to save image ID:', err)
						// Check if it's a duplicate ID error
						if (err.message && err.message.includes('already exists')) {
							setIsDuplicate(true)
						}
						// Revert to the current ID on error
						setLocalValue(currentId)
					})
					.finally(() => {
						setIsUpdating(false)
					})
			}
		},
		[socket, imageId, currentId]
	)

	const handleBlur = useCallback(() => {
		// If the local value is empty or invalid, revert to current ID
		if (!localValue.trim() || !isLabelValid(localValue)) {
			setLocalValue(currentId)
			setIsDuplicate(false)
		}
	}, [localValue, currentId])

	// Update local value when current ID changes (e.g., from server updates)
	useEffect(() => {
		if (!isUpdating) {
			setLocalValue(currentId)
			setIsDuplicate(false)
		}
	}, [currentId, isUpdating])

	// Generate tooltip based on validation state
	const tooltip = !isLabelValid(localValue)
		? 'Invalid ID: Use only letters, numbers, hyphens, and underscores'
		: isDuplicate
			? 'This ID is already in use'
			: undefined

	return (
		<TextInputField
			value={localValue}
			setValue={handleIdChange}
			onBlur={handleBlur}
			placeholder="Enter image ID..."
			tooltip={tooltip}
			checkValid={checkValid}
		/>
	)
})
