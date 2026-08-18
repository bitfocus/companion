import { faDownload, faTrashAlt, faUpload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button.js'
import { CopyButton } from '~/Components/CopyButton.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Grid } from '~/Components/Grid'
import { trpc, trpcClient, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ImageBackgroundColorEditor } from './imageBackgroundColorEditor.js'
import { ImageDescriptionEditor } from './imageDescriptionEditor.js'
import { ImageLibraryImagePreview } from './ImageLibraryImagePreview.js'
import { ImageNameEditModal } from './ImageNameEditModal.js'
import { ImagePreviewBox } from './ImagePreviewBox.js'
import { useImageLibraryUpload } from './useImageLibraryUpload'

interface ImageLibraryEditorProps {
	selectedImageName: string | null
	onDeleteImage: (imageName: string) => void
	onImageNameChanged?: (oldName: string, newName: string) => void
}

export const ImageLibraryEditor = observer(function ImageLibraryEditor({
	selectedImageName,
	onDeleteImage,
	onImageNameChanged,
}: ImageLibraryEditorProps) {
	const { imageLibrary } = useContext(RootAppStoreContext)
	const [uploading, setUploading] = useState(false)
	const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const confirmModalRef = useRef<GenericConfirmModalRef>(null)

	// Get image info from the store
	const imageInfo = selectedImageName ? imageLibrary.getImage(selectedImageName) : null

	// Reset the measured dimensions whenever the image (or its data) changes
	useEffect(() => {
		setDimensions(null)
	}, [selectedImageName, imageInfo?.checksum])

	const deleteMutation = useMutationExt(trpc.imageLibrary.delete.mutationOptions())
	const { uploadImageFile } = useImageLibraryUpload()

	const handleDelete = useCallback(() => {
		if (!selectedImageName) return

		confirmModalRef.current?.show(
			'Delete Image',
			'Are you sure you want to delete this image? This action cannot be undone.',
			'Delete',
			() => {
				deleteMutation
					.mutateAsync({ imageName: selectedImageName })
					.then(() => {
						onDeleteImage(selectedImageName)
					})
					.catch((err) => {
						console.error('Failed to delete image:', err)
					})
			}
		)
	}, [deleteMutation, selectedImageName, onDeleteImage])

	const handleDownload = useCallback(() => {
		if (!selectedImageName || !imageInfo) return

		// Get image data and download
		trpcClient.imageLibrary.getData
			.query({
				imageName: selectedImageName,
				type: 'original',
			})
			.then((imageData) => {
				if (imageData?.image) {
					const subtype = imageInfo.mimeType.split('/')[1]?.split('+')[0] // e.g. 'svg+xml' -> 'svg'
					const ext = subtype === 'jpeg' ? 'jpg' : subtype || 'png'

					// Create download link
					const link = document.createElement('a')
					link.href = imageData.image
					link.download = `${imageInfo.name}.${ext}`
					document.body.appendChild(link)
					link.click()
					document.body.removeChild(link)
				}
			})
			.catch((err) => {
				console.error('Failed to download image:', err)
			})
	}, [selectedImageName, imageInfo])

	const uploadFile = useCallback(
		(file: File) => {
			if (!selectedImageName) return

			setUploading(true)

			uploadImageFile(file, selectedImageName)
				.catch((err) => {
					console.error('Failed to upload image:', err)
				})
				.finally(() => {
					setUploading(false)
				})
		},
		[uploadImageFile, selectedImageName]
	)

	const handleReplaceImage = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.currentTarget.files?.[0]
			event.currentTarget.value = '' // Reset file input

			if (!file) return

			uploadFile(file)
		},
		[uploadFile]
	)

	const handleImageNameChanged = useCallback(
		(oldName: string, newName: string) => {
			onImageNameChanged?.(oldName, newName)
		},
		[onImageNameChanged]
	)

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleString()
	}

	const imageNameFieldId = useId()
	const descriptionFieldId = useId()
	const backgroundColorFieldId = useId()

	if (!selectedImageName) {
		return (
			<div className="image-library-editor">
				<StaticAlert color="info">Select an image from the library to view and edit its properties.</StaticAlert>
			</div>
		)
	}

	if (!imageInfo) {
		return (
			<div className="image-library-editor">
				<StaticAlert color="danger">Failed to load image data.</StaticAlert>
			</div>
		)
	}

	return (
		<div className="image-library-editor">
			<GenericConfirmModal ref={confirmModalRef} />

			<div className="mb-4">
				<div className="flex flex-wrap gap-2">
					<Button color="danger" onClick={handleDelete} title="Delete Image">
						<FontAwesomeIcon icon={faTrashAlt} />
					</Button>

					<Button color="secondary" onClick={handleDownload}>
						<FontAwesomeIcon icon={faDownload} /> Download
					</Button>

					<Button color="warning" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
						<FontAwesomeIcon icon={faUpload} />
						{uploading ? ' Replacing...' : ' Replace'}
					</Button>
				</div>

				<input ref={fileInputRef} type="file" accept="image/*" onChange={handleReplaceImage} className="hidden" />
			</div>

			<Form row className="mb-4">
				<FormLabel htmlFor={imageNameFieldId} sm={4} column="sm">
					Name
				</FormLabel>
				<Grid.Col sm={8} className="flex items-center justify-between">
					<div className="flex items-center">
						<span id={imageNameFieldId} className="font-mono">
							{imageInfo.name}
						</span>
						<CopyButton size="sm" title="Copy variable name" text={`$(image:${imageInfo.name})`} />
					</div>

					<ImageNameEditModal
						imageName={selectedImageName}
						currentName={imageInfo.name}
						onNameChanged={handleImageNameChanged}
					/>
				</Grid.Col>
			</Form>
			<Form row className="mb-4">
				<FormLabel htmlFor={descriptionFieldId} sm={4} column="sm">
					Description
				</FormLabel>
				<Grid.Col sm={8}>
					<ImageDescriptionEditor
						id={descriptionFieldId}
						imageName={selectedImageName}
						currentName={imageInfo.description}
					/>
				</Grid.Col>
			</Form>
			<Form row className="mb-4">
				<FormLabel htmlFor={backgroundColorFieldId} sm={4} column="sm">
					Preview background
				</FormLabel>
				<Grid.Col sm={8} className="flex items-center">
					<ImageBackgroundColorEditor
						id={backgroundColorFieldId}
						imageName={selectedImageName}
						currentColor={imageInfo.backgroundColor}
					/>
				</Grid.Col>
			</Form>

			<ImagePreviewBox
				onFileDrop={uploadFile}
				dragOverMessage="Drop image to replace"
				backgroundColor={imageInfo.backgroundColor}
			>
				<ImageLibraryImagePreview
					imageName={selectedImageName}
					type="original"
					checksum={imageInfo.checksum}
					alt={imageInfo.name}
					onLoad={(width, height) => setDimensions({ width, height })}
				/>
			</ImagePreviewBox>

			<div className="image-properties">
				<div className="image-metadata">
					<div className="metadata-row">
						<span className="metadata-label">Type:</span>
						<span>{imageInfo.mimeType}</span>
					</div>
					{dimensions && (
						<div className="metadata-row">
							<span className="metadata-label">Dimensions:</span>
							<span>
								{dimensions.width} × {dimensions.height} px
							</span>
						</div>
					)}
					<div className="metadata-row">
						<span className="metadata-label">Modified:</span>
						<span>{formatDate(imageInfo.modifiedAt)}</span>
					</div>
				</div>
			</div>
		</div>
	)
})
