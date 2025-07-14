import { CButton, CButtonGroup, CFormInput } from '@coreui/react'
import { faPlus, faImage, faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useState, useMemo, useRef } from 'react'
import { useComputed } from '~/util.js'
import { observer } from 'mobx-react-lite'
import { ImageThumbnail } from './ImageThumbnail'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { ImageCacheProvider, ImageUrlCache } from './ImageCache'
import { ImageAddModal, type ImageAddModalRef } from './ImageAddModal'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable.js'
import type {
	CollectionsNestingTableCollection,
	CollectionsNestingTableItem,
} from '~/Components/CollectionsNestingTable/Types.js'
import type { ImageLibraryInfo } from '@companion-app/shared/Model/ImageLibraryModel.js'
import { useImageLibraryCollectionsApi } from './ImageLibraryCollectionsApi.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { trpc, useMutationExt } from '~/TRPC'

// Adapters for CollectionsNestingTable
interface ImageCollection extends Omit<CollectionsNestingTableCollection, 'children'> {
	label: string
	sortOrder: number
	children: ImageCollection[]
}

interface ImageItem extends CollectionsNestingTableItem {
	// Additional image info
	imageInfo: ImageLibraryInfo
}

interface ImageLibraryGridProps {
	selectedImageName: string | null
	onSelectImage: (imageName: string | null) => void
}

export const ImageLibraryGrid = observer(function ImageLibraryGridInner({
	selectedImageName,
	onSelectImage,
}: ImageLibraryGridProps) {
	const { imageLibrary } = useContext(RootAppStoreContext)
	const [searchQuery, setSearchQuery] = useState('')
	const addModalRef = useRef<ImageAddModalRef>(null)
	const confirmModalRef = useRef<GenericConfirmModalRef>(null)

	const imageCache = useMemo(() => new ImageUrlCache(), [])

	const handleCreateNew = useCallback(() => addModalRef.current?.show(), [])

	const images = imageLibrary.getAllImages()

	// Convert images to items format for CollectionsNestingTable
	const imageItems: ImageItem[] = useComputed(
		() =>
			images.map((image) => ({
				id: image.name,
				collectionId: image.collectionId ?? null,
				sortOrder: image.sortOrder,
				imageInfo: image,
			})),
		[images]
	)

	const collections: ImageCollection[] = imageLibrary.rootImageCollections()

	const collectionsApi = useImageLibraryCollectionsApi(confirmModalRef)

	// Get all collection IDs for the collapse helper
	const allCollectionIds = useMemo(() => collections.map((collection) => collection.id), [collections])

	// ItemRow component for rendering individual images
	const ItemRow = useCallback(
		(item: ImageItem) => {
			if (!item.imageInfo.name.toLowerCase().includes(searchQuery.toLowerCase())) return null

			return (
				<ImageThumbnail
					image={item.imageInfo}
					selected={selectedImageName === item.id}
					onClick={() => onSelectImage(item.id)}
				/>
			)
		},
		[selectedImageName, onSelectImage, searchQuery]
	)

	// // Listen for image library events to clear cache when images are updated or deleted
	// useEffect(() => {
	// 	const handleImageUpdate = (changes: ImageLibraryUpdate[]) => {
	// 		for (const change of changes) {
	// 			imageCache.clearImageName(change.itemName)
	// 		}
	// 	}

	// 	const unsubUpdate = socket.on('image-library:update', handleImageUpdate)

	// 	return () => {
	// 		unsubUpdate()
	// 	}
	// }, [socket, imageCache])

	return (
		<ImageCacheProvider cache={imageCache}>
			<div className="image-library-grid">
				<GenericConfirmModal ref={confirmModalRef} />
				<ImageAddModal ref={addModalRef} onImageCreated={onSelectImage} />

				<div className="image-library-header">
					<h4>Image Library</h4>
					<p>
						Here you can store images to be reused in your buttons. They get exposed as variables, and can be used
						anywhere variables usually can.
					</p>

					<div className="image-library-controls">
						<div className="d-flex gap-2 mb-3">
							<CButtonGroup>
								<CButton color="primary" size="sm" onClick={handleCreateNew}>
									<FontAwesomeIcon icon={faPlus} /> Add Image
								</CButton>
								<CreateCollectionButton />
							</CButtonGroup>
						</div>

						<CFormInput
							type="text"
							placeholder="Search images..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>
				</div>

				<div className="image-library-grid-content">
					<PanelCollapseHelperProvider storageId="image_library" knownPanelIds={allCollectionIds}>
						<CollectionsNestingTable
							ItemRow={ItemRow}
							itemName="image"
							dragId="image-library"
							collectionsApi={collectionsApi}
							selectedItemId={selectedImageName}
							gridLayout={true}
							collections={collections}
							items={imageItems}
							NoContent={NoContent}
						/>
					</PanelCollapseHelperProvider>
				</div>
			</div>
		</ImageCacheProvider>
	)
})

function NoContent() {
	return <NonIdealState icon={faImage} text="No images in library" />
}

function CreateCollectionButton() {
	const createMutation = useMutationExt(trpc.imageLibrary.collections.add.mutationOptions())

	const doCreateCollection = useCallback(() => {
		createMutation.mutateAsync({ collectionName: 'New Collection' }).catch((e) => {
			console.error('Failed to add collection', e)
		})
	}, [createMutation])

	return (
		<CButton color="info" size="sm" onClick={doCreateCollection}>
			<FontAwesomeIcon icon={faLayerGroup} /> Create Collection
		</CButton>
	)
}
