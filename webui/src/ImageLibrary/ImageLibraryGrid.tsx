import { CButton, CButtonGroup, CFormInput } from '@coreui/react'
import { faImage, faLayerGroup, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import fuzzysort from 'fuzzysort'
import { humanId } from 'human-id'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef, useState } from 'react'
import type { ImageLibraryInfo } from '@companion-app/shared/Model/ImageLibraryModel.js'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable.js'
import type { CollectionsNestingTableItem } from '~/Components/CollectionsNestingTable/Types.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { useComputed } from '~/Resources/util'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ImageAddModal, type ImageAddModalRef } from './ImageAddModal'
import { useImageLibraryCollectionsApi } from './ImageLibraryCollectionsApi.js'
import { ImageLibraryDropzone } from './ImageLibraryDropzone'
import { ImageThumbnail } from './ImageThumbnail'
import { useImageLibraryUpload } from './useImageLibraryUpload'

interface ImageItem extends CollectionsNestingTableItem {
	// Additional image info
	imageInfo: ImageLibraryInfo
	fuzzy: Fuzzysort.Prepared
}

interface ImageLibraryGridProps {
	selectedImageName: string | null
	onSelectImage: (imageName: string | null) => void
}

export const ImageLibraryGrid = observer(function ImageLibraryGridInner({
	selectedImageName,
	onSelectImage,
}: ImageLibraryGridProps) {
	const { imageLibrary, notifier } = useContext(RootAppStoreContext)
	const [searchQuery, setSearchQuery] = useState('')
	const addModalRef = useRef<ImageAddModalRef>(null)
	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const gridContentRef = useRef<HTMLDivElement>(null)

	const createMutation = useMutationExt(trpc.imageLibrary.create.mutationOptions())
	const { uploadImageFile } = useImageLibraryUpload()

	const handleImportFiles = useCallback(() => {
		const input = document.createElement('input')
		input.type = 'file'
		input.accept = 'image/*'
		input.multiple = true

		input.onchange = () => {
			const files = input.files
			if (!files || files.length === 0) return

			// Filter for image files only
			const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))

			if (imageFiles.length === 0) {
				notifier.show('Invalid Files', 'Please select image files only', 5000)
				return
			}

			void (async () => {
				try {
					for (const file of imageFiles) {
						// Generate a random ID for the image
						const imageName = humanId({ separator: '-', capitalize: false })

						// Create the image placeholder first
						const fileName = file.name.replace(/\.[^/.]+$/, '') // Remove extension
						await createMutation.mutateAsync({
							name: imageName,
							description: fileName || imageName,
						})

						// Then upload the file
						await uploadImageFile(file, imageName)
					}

					notifier.show(
						'Upload Complete',
						`Successfully uploaded ${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''}`,
						5000
					)
				} catch (err) {
					console.error('Failed to import images:', err)
					notifier.show('Upload Failed', 'Failed to upload one or more images', 5000)
				}
			})()
		}

		input.click()
	}, [createMutation, uploadImageFile, notifier])

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
				fuzzy: fuzzysort.prepare(`${image.name} ${image.description}`),
			})),
		[images]
	)

	const collectionsApi = useImageLibraryCollectionsApi(confirmModalRef)

	// ItemRow component for rendering individual images
	const ItemRow = useCallback(
		(item: ImageItem) => {
			if (searchQuery && fuzzysort.single(searchQuery, item.fuzzy) === null) return null

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

	return (
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
							<CButton color="primary" size="sm" onClick={handleImportFiles}>
								<FontAwesomeIcon icon={faPlus} /> Import Images
							</CButton>
							<CButton color="primary" size="sm" onClick={handleCreateNew}>
								<FontAwesomeIcon icon={faPlus} /> Add Placeholder
							</CButton>
							<CreateCollectionButton />
						</CButtonGroup>
					</div>

					<CFormInput
						type="text"
						aria-label="Search images"
						placeholder="Search images..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>
			</div>

			<ImageLibraryDropzone />

			<div className="image-library-grid-content" ref={gridContentRef}>
				<PanelCollapseHelperProvider storageId="image_library" knownPanelIds={imageLibrary.allCollectionIds}>
					<CollectionsNestingTable
						ItemRow={ItemRow}
						itemName="image"
						dragId="image-library"
						collectionsApi={collectionsApi}
						selectedItemId={selectedImageName}
						gridLayout={true}
						collections={imageLibrary.rootCollections()}
						items={imageItems}
						NoContent={NoContent}
					/>
				</PanelCollapseHelperProvider>
			</div>
		</div>
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
