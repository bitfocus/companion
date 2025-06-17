import { CButton, CFormInput, CAlert } from '@coreui/react'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useState } from 'react'
import { SocketContext } from '~/util.js'
import { observer } from 'mobx-react-lite'
import { ImageThumbnail } from './ImageThumbnail'
import { nanoid } from 'nanoid'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface ImageLibraryGridProps {
	selectedImageId: string | null
	onSelectImage: (imageId: string | null) => void
}

export const ImageLibraryGrid = observer(function ImageLibraryGrid({
	selectedImageId,
	onSelectImage,
}: ImageLibraryGridProps) {
	const socket = useContext(SocketContext)
	const { imageLibrary } = useContext(RootAppStoreContext)
	const [searchQuery, setSearchQuery] = useState('')

	const images = imageLibrary.getAllImages()

	const handleCreateNew = useCallback(() => {
		const id = nanoid()
		const name = 'New Image'

		socket
			.emitPromise('image-library:create', [id, name])
			.then(() => {
				onSelectImage(id)
			})
			.catch((err) => {
				console.error('Failed to create new image:', err)
			})
	}, [socket, onSelectImage])

	const filteredImages = images.filter((image) => image.name.toLowerCase().includes(searchQuery.toLowerCase()))

	return (
		<div className="image-library-grid">
			<div className="image-library-header">
				<h4>Image Library</h4>
				<p>Manage your image library. Click on an image to edit its properties.</p>

				<div className="image-library-controls">
					<CFormInput
						type="text"
						placeholder="Search images..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="mb-3"
					/>

					<div className="d-flex gap-2 mb-3">
						<CButton color="primary" onClick={handleCreateNew}>
							<FontAwesomeIcon icon={faPlus} /> New Image
						</CButton>
					</div>
				</div>
			</div>

			<div className="image-library-grid-content">
				{filteredImages.length === 0 ? (
					<CAlert color="info">
						{searchQuery
							? 'No images match your search.'
							: 'No images in library. Create or upload some images to get started.'}
					</CAlert>
				) : (
					<div className="image-thumbnails-grid">
						{filteredImages.map((image) => (
							<ImageThumbnail
								key={image.id}
								image={image}
								selected={selectedImageId === image.id}
								onClick={() => onSelectImage(image.id)}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	)
})
