import { faLayerGroup, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { humanId } from 'human-id'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef } from 'react'
import { Button } from '~/Components/Button.js'
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
		<div className="image-library-grid flex flex-col gap-2">
			<GenericConfirmModal ref={confirmModalRef} />
			<ImageAddModal ref={addModalRef} onImageCreated={onSelectImage} />

			{/* Top Header Card: Toolbar & Actions */}
			<div className="bg-surface-muted/50 border border-border/70 p-3 rounded-lg flex items-center justify-between gap-2 flex-wrap shrink-0">
				<div>
					<p className="text-xs text-muted mb-0">
						Store custom images to reuse on button surfaces or expose dynamically via variables.
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Button color="primary" size="sm" onClick={handleImportFiles}>
						<FontAwesomeIcon icon={faPlus} className="me-1.5" /> Import Images
					</Button>
					<Button color="secondary" size="sm" onClick={handleCreateNew}>
						<FontAwesomeIcon icon={faPlus} className="me-1.5" /> Add Placeholder
					</Button>
					<CreateCollectionButton />
				</div>
			</div>

			<ImageLibraryDropzone />

			<div className="image-library-grid-content rounded-md border border-border/70 bg-surface p-2">
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
		<Button color="secondary" size="sm" onClick={doCreateCollection}>
			<FontAwesomeIcon icon={faLayerGroup} className="me-1.5" /> Create Collection
		</Button>
	)
}
