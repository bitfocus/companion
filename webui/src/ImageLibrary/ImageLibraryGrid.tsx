import { faLayerGroup, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useRef } from 'react'
import { Button } from '~/Components/Button.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { ImageAddModal, type ImageAddModalRef } from './ImageAddModal'
import { useImageLibraryCollectionsApi } from './ImageLibraryCollectionsApi.js'
import { ImageLibraryDropzone } from './ImageLibraryDropzone'
import { ImageLibrarySelector } from './ImageLibrarySelector'
import { useImportImageFiles } from './useImportImageFiles'

interface ImageLibraryGridProps {
	selectedImageName: string | null
	onSelectImage: (imageName: string | null) => void
}

export const ImageLibraryGrid = observer(function ImageLibraryGridInner({
	selectedImageName,
	onSelectImage,
}: ImageLibraryGridProps) {
	const addModalRef = useRef<ImageAddModalRef>(null)
	const confirmModalRef = useRef<GenericConfirmModalRef>(null)

	const handleImportFiles = useImportImageFiles()

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
