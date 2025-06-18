import { CButton, CFormInput } from '@coreui/react'
import { faPlus, faImage, faSearch } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useState, useEffect, useMemo } from 'react'
import { SocketContext } from '~/util.js'
import { observer } from 'mobx-react-lite'
import { ImageThumbnail } from './ImageThumbnail'
import { nanoid } from 'nanoid'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { ImageCacheProvider, ImageUrlCache } from './ImageCache'

interface ImageLibraryGridProps {
	selectedImageId: string | null
	onSelectImage: (imageId: string | null) => void
}

export const ImageLibraryGrid = observer(function ImageLibraryGridInner({
	selectedImageId,
	onSelectImage,
}: ImageLibraryGridProps) {
	const socket = useContext(SocketContext)
	const { imageLibrary } = useContext(RootAppStoreContext)
	const [searchQuery, setSearchQuery] = useState('')

	const imageCache = useMemo(() => new ImageUrlCache(), [])

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
	const hiddenCount = images.length - filteredImages.length

	// Listen for image library events to clear cache when images are updated or deleted
	useEffect(() => {
		const handleImageUpdated = (imageId: string) => {
			imageCache.clearImageId(imageId)
		}

		const handleImageRemoved = (imageId: string) => {
			imageCache.clearImageId(imageId)
		}

		const unsubUpdated = socket.on('image-library:updated', handleImageUpdated)
		const unsubRemoved = socket.on('image-library:removed', handleImageRemoved)

		return () => {
			unsubUpdated()
			unsubRemoved()
		}
	}, [socket, imageCache])

	return (
		<ImageCacheProvider cache={imageCache}>
			<div className="image-library-grid">
				<div className="image-library-header">
					<h4>Image Library</h4>
					<p>
						Here you can store images to be reused in your buttons. They get exposed as variables, so that they can be
						used in buttons.
					</p>

					<div className="image-library-controls">
						<CFormInput
							type="text"
							placeholder="Search images..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="mb-3"
						/>

						<div className="d-flex gap-2">
							<CButton color="primary" size="sm" onClick={handleCreateNew}>
								<FontAwesomeIcon icon={faPlus} /> Add Image
							</CButton>
						</div>
					</div>
				</div>

				<div className="image-library-grid-content">
					{images.length === 0 ? (
						<NonIdealState icon={faImage} text="No images in library" />
					) : filteredImages.length === 0 ? (
						<NonIdealState icon={faSearch} text="No images match your search" />
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

					{searchQuery && hiddenCount > 0 && filteredImages.length > 0 && (
						<div className="mt-3 text-muted text-center">
							<small>
								{hiddenCount} image{hiddenCount !== 1 ? 's' : ''} hidden by search filter
							</small>
						</div>
					)}
				</div>
			</div>
		</ImageCacheProvider>
	)
})
