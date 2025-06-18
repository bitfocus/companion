import React, { useState, useCallback, useContext, useEffect } from 'react'
import { CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CButton, CAlert, CFormLabel } from '@coreui/react'
import { SocketContext } from '~/util.js'
import { observer } from 'mobx-react-lite'
import { isLabelValid } from '@companion-app/shared/Label.js'
import { TextInputField } from '~/Components/TextInputField.js'

interface ImageIdEditModalProps {
	visible: boolean
	onClose: () => void
	imageId: string
	currentId: string
	onIdChanged?: (oldId: string, newId: string) => void
}

export const ImageIdEditModal = observer(function ImageIdEditModal({
	visible,
	onClose,
	imageId,
	currentId,
	onIdChanged,
}: ImageIdEditModalProps) {
	const socket = useContext(SocketContext)
	const [localValue, setLocalValue] = useState(currentId)
	const [isSaving, setIsSaving] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	// Reset state when modal opens
	useEffect(() => {
		if (visible) {
			setLocalValue(currentId)
			setErrorMessage(null)
		}
	}, [visible, currentId])

	const handleSave = useCallback(() => {
		if (!isLabelValid(localValue)) {
			// The label is already shown as invalid, no need to tell them again
			return
		}

		if (localValue === currentId) {
			// No change, just close
			onClose()
			return
		}

		setIsSaving(true)
		setErrorMessage(null)

		socket
			.emitPromise('image-library:set-id', [imageId, localValue])
			.then((result) => {
				// Server returns the sanitized ID on success
				if (typeof result === 'string') {
					const newId = result
					// Notify parent of the ID change
					if (onIdChanged && newId !== currentId) {
						onIdChanged(currentId, newId)
					}
					onClose()
				}
			})
			.catch((err) => {
				console.error('Failed to save image ID:', err)
				// Provide more specific error messages
				if (err.message || err) {
					setErrorMessage(err.message || err)
				} else {
					setErrorMessage('Failed to save image ID. Check it is valid and try again.')
				}
			})
			.finally(() => {
				setIsSaving(false)
			})
	}, [socket, imageId, currentId, localValue, onIdChanged, onClose])

	const handleCancel = useCallback(() => {
		setLocalValue(currentId)
		setErrorMessage(null)
		onClose()
	}, [currentId, onClose])

	const handleValueChange = useCallback((newValue: string) => {
		setLocalValue(newValue)
		setErrorMessage(null)
	}, [])

	// Generate tooltip based on validation state
	const tooltip = !isLabelValid(localValue)
		? 'Invalid ID: Use only letters, numbers, hyphens, and underscores'
		: undefined

	const canSave = isLabelValid(localValue) && localValue !== currentId

	return (
		<CModal visible={visible} onClose={handleCancel} backdrop="static">
			<CModalHeader>
				<CModalTitle>Edit Image ID</CModalTitle>
			</CModalHeader>
			<CModalBody>
				{errorMessage && (
					<CAlert color="danger" className="mb-3">
						{errorMessage}
					</CAlert>
				)}

				<CAlert color="warning" className="mb-3">
					<strong>Warning:</strong> Changing the image ID will break any existing references to this image in button
					configurations, actions, or other places where this ID is currently used.
				</CAlert>

				<div className="mb-3 row">
					<CFormLabel htmlFor="imageIdInput" className="col-sm-3 col-form-label">
						Image ID
					</CFormLabel>
					<div className="col-sm-9">
						<TextInputField
							value={localValue}
							setValue={handleValueChange}
							placeholder="Enter image ID..."
							tooltip={tooltip}
							checkValid={isLabelValid}
							disabled={isSaving}
						/>
					</div>
				</div>
				<div className="text-muted small">
					The image ID is used to reference this image in button configurations and other places.
					<br />
					It must contain only letters, numbers, hyphens, and underscores.
				</div>
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={handleCancel} disabled={isSaving}>
					Cancel
				</CButton>
				<CButton color="primary" onClick={handleSave} disabled={!canSave || isSaving}>
					{isSaving ? 'Saving...' : 'Save'}
				</CButton>
			</CModalFooter>
		</CModal>
	)
})
