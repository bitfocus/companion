import { faLayerGroup, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { humanId } from 'human-id'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef } from 'react'
import { Button, ButtonGroup } from '~/Components/Button.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ImageAddModal, type ImageAddModalRef } from './ImageAddModal'
import { useImageLibraryCollectionsApi } from './ImageLibraryCollectionsApi.js'
import { ImageLibraryDropzone } from './ImageLibraryDropzone'
import { ImageLibrarySelector } from './ImageLibrarySelector'
import { useImageLibraryUpload } from './useImageLibraryUpload'

interface ImageLibraryGridProps {
	selectedImageName: string | null
	onSelectImage: (imageName: string | null) => void
}

export const ImageLibraryGrid = observer(function ImageLibraryGridInner({
	selectedImageName,
	onSelectImage,
}: ImageLibraryGridProps) {
	const { notifier } = useContext(RootAppStoreContext)
	const addModalRef = useRef<ImageAddModalRef>(null)
	const confirmModalRef = useRef<GenericConfirmModalRef>(null)

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

	const collectionsApi = useImageLibraryCollectionsApi(confirmModalRef)

	return (
		<div className="image-library-grid">
			<GenericConfirmModal ref={confirmModalRef} />
			<ImageAddModal ref={addModalRef} onImageCreated={onSelectImage} />

			<div className="image-library-header pb-2">
				<h4>Image Library</h4>
				<p>
					Here you can store images to be reused in your buttons. They get exposed as variables, and can be used
					anywhere variables usually can.
				</p>

				<div className="image-library-controls">
					<ButtonGroup>
						<Button color="primary" size="sm" onClick={handleImportFiles}>
							<FontAwesomeIcon icon={faPlus} /> Import Images
						</Button>
						<Button color="primary" size="sm" onClick={handleCreateNew}>
							<FontAwesomeIcon icon={faPlus} /> Add Placeholder
						</Button>
						<CreateCollectionButton />
					</ButtonGroup>
				</div>
			</div>

			<ImageLibraryDropzone />

			<div className="image-library-grid-content">
				<ImageLibrarySelector
					selectedImageName={selectedImageName}
					onSelectImage={onSelectImage}
					collectionsApi={collectionsApi}
					dragId="image-library"
				/>
			</div>
		</div>
	)
})

function CreateCollectionButton() {
	const createMutation = useMutationExt(trpc.imageLibrary.collections.add.mutationOptions())

	const doCreateCollection = useCallback(() => {
		createMutation.mutateAsync({ collectionName: 'New Collection' }).catch((e) => {
			console.error('Failed to add collection', e)
		})
	}, [createMutation])

	return (
		<Button color="info" size="sm" onClick={doCreateCollection}>
			<FontAwesomeIcon icon={faLayerGroup} /> Create Collection
		</Button>
	)
}
