import React, { useState, useCallback, useContext, useEffect } from 'react'
import { CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CButton } from '@coreui/react'
import { SocketContext } from '~/util.js'
import { observer } from 'mobx-react-lite'
import { isLabelValid } from '@companion-app/shared/Label.js'
import { ImageNameInput } from './ImageNameInput'

interface ImageNameEditModalProps {
	visible: boolean
	onClose: () => void
	imageName: string
	currentName: string
	onNameChanged?: (oldName: string, newName: string) => void
}

export const ImageNameEditModal = observer(function ImageNameEditModal({
	visible,
	onClose,
	imageName,
	currentName,
	onNameChanged,
}: ImageNameEditModalProps) {
	const socket = useContext(SocketContext)
	const [localValue, setLocalValue] = useState(currentName)
	const [isSaving, setIsSaving] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	// Reset state when modal opens
	useEffect(() => {
		if (visible) {
			setLocalValue(currentName)
			setErrorMessage(null)
		}
	}, [visible, currentName])

	const handleSave = useCallback(() => {
		if (!isLabelValid(localValue)) {
			// The label is already shown as invalid, no need to tell them again
			return
		}

		if (localValue === currentName) {
			// No change, just close
			onClose()
			return
		}

		setIsSaving(true)
		setErrorMessage(null)

		socket
			.emitPromise('image-library:set-name', [imageName, localValue])
			.then((result) => {
				// Server returns the sanitized name on success
				if (typeof result === 'string') {
					const newName = result
					// Notify parent of the name change
					if (onNameChanged && newName !== currentName) {
						onNameChanged(currentName, newName)
					}
					onClose()
				}
			})
			.catch((err) => {
				console.error('Failed to save image name:', err)
				// Provide more specific error messages
				if (err.message || err) {
					setErrorMessage(err.message || err)
				} else {
					setErrorMessage('Failed to save image name. Check it is valid and try again.')
				}
			})
			.finally(() => {
				setIsSaving(false)
			})
	}, [socket, imageName, currentName, localValue, onNameChanged, onClose])

	const handleCancel = useCallback(() => {
		setLocalValue(currentName)
		setErrorMessage(null)
		onClose()
	}, [currentName, onClose])

	const handleValueChange = useCallback((newValue: string) => {
		setLocalValue(newValue)
		setErrorMessage(null)
	}, [])

	const canSave = isLabelValid(localValue) && localValue !== currentName

	const warningText = (
		<>
			<strong>Warning:</strong> Changing the image name will break any existing references to this image in button
			configurations, actions, or other places where this name is currently used.
		</>
	)

	return (
		<CModal visible={visible} onClose={handleCancel} backdrop="static">
			<CModalHeader>
				<CModalTitle>Edit Image name</CModalTitle>
			</CModalHeader>
			<CModalBody>
				<ImageNameInput
					value={localValue}
					onChange={handleValueChange}
					disabled={isSaving}
					errorMessage={errorMessage}
					showWarning={true}
					warningText={warningText}
				/>
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
