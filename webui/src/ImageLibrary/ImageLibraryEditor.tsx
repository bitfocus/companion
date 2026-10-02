import { faDownload, faImages, faTrashAlt, faUpload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button.js'
import { CopyButton } from '~/Components/CopyButton.js'
import { EditSectionCard } from '~/Components/EditSectionCard.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
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
			<div className="flex items-center justify-center h-full p-8 text-center">
				<NonIdealState icon={faImages} text="Select an image from the library to view and edit its properties." />
			</div>
		)
	}

	if (!imageInfo) {
		return (
			<div className="p-4">
				<StaticAlert color="danger">Failed to load image data.</StaticAlert>
			</div>
		)
	}

	return (
		<div className="edit-panel image-library-editor">
			<GenericConfirmModal ref={confirmModalRef} />
			<input ref={fileInputRef} type="file" accept="image/*" onChange={handleReplaceImage} className="hidden" />

			<EditSectionCard title="Image">
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
				<div className="flex items-center justify-between gap-2">
					<span className="text-xs text-muted">Drop an image on the preview to replace it</span>
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="sm"
							color="primary"
							onClick={() => fileInputRef.current?.click()}
							disabled={uploading}
						>
							<FontAwesomeIcon icon={faUpload} className="me-1.5" />
							{uploading ? 'Replacing…' : 'Replace'}
						</Button>
						<Button variant="ghost" size="sm" color="primary" onClick={handleDownload}>
							<FontAwesomeIcon icon={faDownload} className="me-1.5" />
							Download
						</Button>
					</div>
				</div>
			</EditSectionCard>

			<EditSectionCard title="General Settings">
				<div className="edit-field-row">
					<label htmlFor={imageNameFieldId} className="text-xs font-semibold text-body">
						Name
					</label>
					<div className="flex items-center gap-1 min-w-0">
						<span id={imageNameFieldId} className="font-mono text-xs text-body truncate">
							{imageInfo.name}
						</span>
						<CopyButton size="sm" title="Copy variable name" text={`$(image:${imageInfo.name})`} />
						<span className="ms-auto">
							<ImageNameEditModal
								imageName={selectedImageName}
								currentName={imageInfo.name}
								onNameChanged={handleImageNameChanged}
							/>
						</span>
					</div>
				</div>
				<div className="edit-field-row">
					<label htmlFor={descriptionFieldId} className="text-xs font-semibold text-body">
						Description
					</label>
					<ImageDescriptionEditor
						id={descriptionFieldId}
						imageName={selectedImageName}
						currentName={imageInfo.description}
					/>
				</div>
				<div className="edit-field-row">
					<label htmlFor={backgroundColorFieldId} className="text-xs font-semibold text-body">
						Preview background
					</label>
					<div className="flex items-center">
						<ImageBackgroundColorEditor
							id={backgroundColorFieldId}
							imageName={selectedImageName}
							currentColor={imageInfo.backgroundColor}
						/>
					</div>
				</div>
			</EditSectionCard>

			<EditSectionCard title="Image Info">
				<ImageInfoRow label="Type">{imageInfo.mimeType}</ImageInfoRow>
				<ImageInfoRow label="Dimensions">
					{dimensions ? `${dimensions.width} × ${dimensions.height} px` : '…'}
				</ImageInfoRow>
				<ImageInfoRow label="Modified">{formatDate(imageInfo.modifiedAt)}</ImageInfoRow>
			</EditSectionCard>

			<EditSectionCard title="Delete Image" collapsible danger>
				<div className="flex items-center justify-between gap-3">
					<p className="text-xs text-muted mb-0">Permanently delete this image from the library.</p>
					<Button color="danger" size="sm" onClick={handleDelete}>
						<FontAwesomeIcon icon={faTrashAlt} className="me-1.5" />
						Delete
					</Button>
				</div>
			</EditSectionCard>
		</div>
	)
})

function ImageInfoRow({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="edit-field-row">
			<span className="text-xs font-semibold text-body">{label}</span>
			<div className="text-xs text-body min-w-0">{children}</div>
		</div>
	)
}
