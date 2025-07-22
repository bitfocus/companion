import { CFormInput } from '@coreui/react'
import React, { useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import { trpc, useMutationExt } from '~/Resources/TRPC'

interface ImageDescriptionEditorProps {
	imageName: string
	currentName: string
}

export const ImageDescriptionEditor = observer(function ImageDescriptionEditor({
	imageName,
	currentName,
}: ImageDescriptionEditorProps) {
	const setDescriptionMutation = useMutationExt(trpc.imageLibrary.setDescription.mutationOptions())

	const handleNameChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setDescriptionMutation.mutateAsync({ imageName, description: e.target.value }).catch((err) => {
				console.error('Failed to save image description:', err)
			})
		},
		[setDescriptionMutation, imageName]
	)

	return (
		<CFormInput type="text" value={currentName} onChange={handleNameChange} placeholder="Enter image description..." />
	)
})
