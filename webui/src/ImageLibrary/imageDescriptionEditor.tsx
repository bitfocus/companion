import { CFormInput } from '@coreui/react'
import React, { useCallback, useContext } from 'react'
import { SocketContext } from '~/util.js'
import { observer } from 'mobx-react-lite'

interface ImageDescriptionEditorProps {
	imageName: string
	currentName: string
}

export const ImageDescriptionEditor = observer(function ImageDescriptionEditor({
	imageName,
	currentName,
}: ImageDescriptionEditorProps) {
	const socket = useContext(SocketContext)

	const handleNameChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			socket.emitPromise('image-library:set-description', [imageName, e.target.value]).catch((err) => {
				console.error('Failed to save image description:', err)
			})
		},
		[socket, imageName]
	)

	return (
		<CFormInput type="text" value={currentName} onChange={handleNameChange} placeholder="Enter image description..." />
	)
})
