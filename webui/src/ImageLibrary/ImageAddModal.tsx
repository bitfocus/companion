import React, { useState, useCallback, useContext, useEffect } from 'react'
import { CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CButton, CAlert, CFormLabel } from '@coreui/react'
import { SocketContext } from '~/util.js'
import { observer } from 'mobx-react-lite'
import { isLabelValid } from '@companion-app/shared/Label.js'
import { TextInputField } from '~/Components/TextInputField.js'

interface ImageAddModalProps {
	visible: boolean
	onClose: () => void
	onImageCreated?: (imageId: string) => void
}

export const ImageAddModal = observer(function ImageAddModal({ visible, onClose, onImageCreated }: ImageAddModalProps) {
	const socket = useContext(SocketContext)
	const [localValue, setLocalValue] = useState('')
	const [isCreating, setIsCreating] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	// Reset state when modal opens
	useEffect(() => {
		if (visible) {
			setLocalValue('')
			setErrorMessage(null)
		}
	}, [visible])

	const handleCreate = useCallback(() => {
		if (!isLabelValid(localValue)) {
			// The label is already shown as invalid, no need to tell them again
			return
		}

		if (!localValue.trim()) {
			setErrorMessage('Image ID is required')
			return
		}

		setIsCreating(true)
		setErrorMessage(null)

		// Use the ID as both the ID and the name
		socket
			.emitPromise('image-library:create', [localValue.trim(), localValue.trim()])
			.then((result) => {
				// Server returns the sanitized ID on success
				if (typeof result === 'string') {
					const newId = result
					// Notify parent of the new image
					if (onImageCreated) {
						onImageCreated(newId)
					}
					onClose()
				}
			})
			.catch((err) => {
				console.error('Failed to create image:', err)
				// Provide more specific error messages
				if (err.message || err) {
					setErrorMessage(err.message || err)
				} else {
					setErrorMessage('Failed to create image. Check the ID is valid and try again.')
				}
			})
			.finally(() => {
				setIsCreating(false)
			})
	}, [socket, localValue, onImageCreated, onClose])

	const handleCancel = useCallback(() => {
		setLocalValue('')
		setErrorMessage(null)
		onClose()
	}, [onClose])

	const handleValueChange = useCallback((newValue: string) => {
		setLocalValue(newValue)
		setErrorMessage(null)
	}, [])

	// Generate tooltip based on validation state
	const tooltip = !isLabelValid(localValue)
		? 'Invalid ID: Use only letters, numbers, hyphens, and underscores'
		: undefined

	const canCreate = isLabelValid(localValue) && localValue.trim() !== ''

	return (
		<CModal visible={visible} onClose={handleCancel} backdrop="static">
			<CModalHeader>
				<CModalTitle>Add New Image</CModalTitle>
			</CModalHeader>
			<CModalBody>
				{errorMessage && (
					<CAlert color="danger" className="mb-3">
						{errorMessage}
					</CAlert>
				)}

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
							disabled={isCreating}
						/>
					</div>
				</div>
				<div className="text-muted small">
					The image ID will be used to reference this image in button configurations and other places.
					<br />
					The image name will be set to match the ID and can be changed later.
					<br />
					It must contain only letters, numbers, hyphens, and underscores.
				</div>
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={handleCancel} disabled={isCreating}>
					Cancel
				</CButton>
				<CButton color="primary" onClick={handleCreate} disabled={!canCreate || isCreating}>
					{isCreating ? 'Creating...' : 'Create'}
				</CButton>
			</CModalFooter>
		</CModal>
	)
})
