import React, { useState, useCallback, useContext, useEffect, forwardRef, useImperativeHandle } from 'react'
import { CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CButton } from '@coreui/react'
import { SocketContext } from '~/util.js'
import { observer } from 'mobx-react-lite'
import { isLabelValid } from '@companion-app/shared/Label.js'
import { ImageNameInput } from './ImageNameInput'

interface ImageAddModalProps {
	onImageCreated?: (imageName: string) => void
}

export interface ImageAddModalRef {
	show(): void
}

export const ImageAddModal = observer(
	forwardRef<ImageAddModalRef, ImageAddModalProps>(function ImageAddModal({ onImageCreated }, ref) {
		const socket = useContext(SocketContext)
		const [visible, setVisible] = useState(false)
		const [localValue, setLocalValue] = useState('')
		const [isCreating, setIsCreating] = useState(false)
		const [errorMessage, setErrorMessage] = useState<string | null>(null)

		useImperativeHandle(
			ref,
			() => ({
				show() {
					setVisible(true)
				},
			}),
			[]
		)

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
				setErrorMessage('Image name is required')
				return
			}

			setIsCreating(true)
			setErrorMessage(null)

			// Use the name as both the name and the description
			socket
				.emitPromise('image-library:create', [localValue.trim(), localValue.trim()])
				.then((result) => {
					// Server returns the sanitized name on success
					if (typeof result === 'string') {
						const newName = result
						// Notify parent of the new image
						if (onImageCreated) {
							onImageCreated(newName)
						}
						setVisible(false)
					}
				})
				.catch((err) => {
					console.error('Failed to create image:', err)
					// Provide more specific error messages
					if (err.message || err) {
						setErrorMessage(err.message || err)
					} else {
						setErrorMessage('Failed to create image. Check the name is valid and try again.')
					}
				})
				.finally(() => {
					setIsCreating(false)
				})
		}, [socket, localValue, onImageCreated])

		const handleCancel = useCallback(() => {
			setLocalValue('')
			setErrorMessage(null)
			setVisible(false)
		}, [])

		const handleValueChange = useCallback((newValue: string) => {
			setLocalValue(newValue)
			setErrorMessage(null)
		}, [])

		const canCreate = isLabelValid(localValue) && localValue.trim() !== ''

		const helpText = (
			<>
				The image name will be used to reference this image in button configurations and other places.
				<br />
				It must contain only letters, numbers, hyphens, and underscores.
			</>
		)

		return (
			<CModal visible={visible} onClose={handleCancel} backdrop="static">
				<CModalHeader>
					<CModalTitle>Add New Image</CModalTitle>
				</CModalHeader>
				<CModalBody>
					<ImageNameInput
						value={localValue}
						onChange={handleValueChange}
						disabled={isCreating}
						errorMessage={errorMessage}
						helpText={helpText}
					/>
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
)
