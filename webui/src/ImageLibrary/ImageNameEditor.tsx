import { CFormInput } from '@coreui/react'
import React, { useCallback, useContext } from 'react'
import { SocketContext } from '~/util.js'
import { observer } from 'mobx-react-lite'

interface ImageNameEditorProps {
	imageId: string
	currentName: string
}

export const ImageNameEditor = observer(function ImageNameEditor({ imageId, currentName }: ImageNameEditorProps) {
	const socket = useContext(SocketContext)

	const handleNameChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			socket.emitPromise('image-library:set-name', [imageId, e.target.value]).catch((err) => {
				console.error('Failed to save image name:', err)
			})
		},
		[socket, imageId]
	)

	return <CFormInput type="text" value={currentName} onChange={handleNameChange} placeholder="Enter image name..." />
})
