import { faEdit } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useEffect, useState } from 'react'
import { isLabelValid } from '@companion-app/shared/Label.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { Button } from '~/Components/Button'
import { Modal } from '~/Components/Modal'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { ImageNameInput } from './ImageNameInput'

interface ImageNameEditModalProps {
	imageName: string
	currentName: string
	onNameChanged: (oldName: string, newName: string) => void
}

export const ImageNameEditModal = observer(function ImageNameEditModal({
	imageName,
	currentName,
	onNameChanged,
}: ImageNameEditModalProps) {
	const [localValue, setLocalValue] = useState(currentName)
	const [isSaving, setIsSaving] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [visible, setVisible] = useState(false)

	// Reset state when modal opens
	useEffect(() => {
		if (visible) {
			setLocalValue(currentName)
			setErrorMessage(null)
		}
	}, [visible, currentName])

	const setNameMutation = useMutationExt(trpc.imageLibrary.setName.mutationOptions())

	const handleSave = useCallback(() => {
		if (!isLabelValid(localValue)) {
			// The label is already shown as invalid, no need to tell them again
			return
		}

		if (localValue === currentName) {
			// No change, just close
			setVisible(false)
			return
		}

		setIsSaving(true)
		setErrorMessage(null)

		setNameMutation
			.mutateAsync({ imageName, newName: localValue })
			.then((result) => {
				// Server returns the sanitized name on success
				if (typeof result === 'string') {
					const newName = result
					// Notify parent of the name change
					if (onNameChanged && newName !== currentName) {
						onNameChanged(currentName, newName)
					}
					setVisible(false)
				}
			})
			.catch((err) => {
				console.error('Failed to save image name:', err)
				// Provide more specific error messages
				if (err) {
					setErrorMessage(stringifyError(err))
				} else {
					setErrorMessage('Failed to save image name. Check it is valid and try again.')
				}
			})
			.finally(() => {
				setIsSaving(false)
			})
	}, [setNameMutation, imageName, currentName, localValue, onNameChanged, setVisible])

	const onOpenChangeComplete = useCallback(
		(open: boolean) => {
			if (!open) {
				setLocalValue(currentName)
				setErrorMessage(null)
			}
		},
		[currentName]
	)

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
		<Modal.Root open={visible} onOpenChange={setVisible} onOpenChangeComplete={onOpenChangeComplete}>
			<Modal.Trigger color="secondary" size="sm" title="Edit Image name">
				<FontAwesomeIcon icon={faEdit} />
			</Modal.Trigger>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup>
						<Modal.Header closeButton>
							<Modal.Title>Edit Image name</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							<ImageNameInput
								value={localValue}
								onChange={handleValueChange}
								disabled={isSaving}
								errorMessage={errorMessage}
								showWarning={true}
								warningText={warningText}
							/>
						</Modal.Body>
						<Modal.Footer>
							<Modal.Close disabled={isSaving}>Cancel</Modal.Close>
							<Button color="primary" onClick={handleSave} disabled={!canSave || isSaving}>
								{isSaving ? 'Saving...' : 'Save'}
							</Button>
						</Modal.Footer>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
})
