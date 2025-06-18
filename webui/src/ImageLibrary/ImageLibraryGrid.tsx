import { CButton, CFormInput } from '@coreui/react'
import { faPlus, faImage } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useState, useEffect, useMemo, useRef } from 'react'
import { SocketContext } from '~/util.js'
import { observer } from 'mobx-react-lite'
import { ImageThumbnail } from './ImageThumbnail'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { ImageCacheProvider, ImageUrlCache } from './ImageCache'
import { ImageAddModal, type ImageAddModalRef } from './ImageAddModal'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable.js'
import type {
	NestingCollectionsApi,
	CollectionsNestingTableCollection,
	CollectionsNestingTableItem,
} from '~/Components/CollectionsNestingTable/Types.js'
import type { ImageLibraryInfo } from '@companion-app/shared/Model/ImageLibraryModel.js'

// Adapters for CollectionsNestingTable
interface ImageCollection extends Omit<CollectionsNestingTableCollection, 'children'> {
	id: string
	label?: string
	sortOrder?: number
	children: ImageCollection[]
}

interface ImageItem extends CollectionsNestingTableItem {
	id: string
	collectionId: string | null
	sortOrder: number
	// Additional image info
	imageInfo: ImageLibraryInfo
}

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
	const addModalRef = useRef<ImageAddModalRef>(null)

	const imageCache = useMemo(() => new ImageUrlCache(), [])

	const handleCreateNew = useCallback(() => addModalRef.current?.show(), [])

	const images = imageLibrary.getAllImages()

	// Convert images to items format for CollectionsNestingTable
	const imageItems: ImageItem[] = useMemo(() => {
		return images.map((image, index) => ({
			id: image.id,
			collectionId: null, // No collections for now
			sortOrder: index,
			imageInfo: image,
		}))
	}, [images])

	// Empty collections array for now
	const collections: ImageCollection[] = []

	// Placeholder collections API
	const collectionsApi: NestingCollectionsApi = useMemo(
		() => ({
			createCollection: () => {
				// TODO: Implement collection creation
				console.log('Create collection - not implemented')
			},
			renameCollection: () => {
				// TODO: Implement collection renaming
				console.log('Rename collection - not implemented')
			},
			deleteCollection: () => {
				// TODO: Implement collection deletion
				console.log('Delete collection - not implemented')
			},
			moveCollection: () => {
				// TODO: Implement collection moving
				console.log('Move collection - not implemented')
			},
			moveItemToCollection: () => {
				// TODO: Implement item moving to collection
				console.log('Move item to collection - not implemented')
			},
		}),
		[]
	)

	// ItemRow component for rendering individual images
	const ItemRow = useCallback(
		(item: ImageItem) => {
			if (!item.imageInfo.name.toLowerCase().includes(searchQuery.toLowerCase())) return null

			return (
				<ImageThumbnail
					image={item.imageInfo}
					selected={selectedImageId === item.id}
					onClick={() => onSelectImage(item.id)}
				/>
			)
		},
		[selectedImageId, onSelectImage, searchQuery]
	)

	// NoContent component
	const NoContent = useCallback(() => <NonIdealState icon={faImage} text="No images in library" />, [])

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
				<ImageAddModal ref={addModalRef} onImageCreated={onSelectImage} />

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
					<CollectionsNestingTable
						ItemRow={ItemRow}
						itemName="image"
						dragId="image-library"
						collectionsApi={collectionsApi}
						selectedItemId={selectedImageId}
						gridLayout={true}
						collections={collections}
						items={imageItems}
						NoContent={NoContent}
					/>
				</div>
			</div>
		</ImageCacheProvider>
	)
})
