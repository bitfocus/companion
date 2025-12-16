import { CAlert, CButton, CCol, CForm, CFormLabel } from '@coreui/react'
import { faDownload, faTrashAlt, faUpload, faEdit, faCopy } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useRef, useState } from 'react'
import { base64EncodeUint8Array } from '~/Resources/util.js'
import { observer } from 'mobx-react-lite'
import { blobToDataURL } from '~/Helpers/FileUpload.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ImageLibraryImagePreview } from './ImageLibraryImagePreview.js'
import { ImageDescriptionEditor } from './imageDescriptionEditor.js'
import { ImageNameEditModal } from './ImageNameEditModal.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import CryptoJS from 'crypto-js'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { trpc, trpcClient, useMutationExt } from '~/Resources/TRPC.js'

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
	const { imageLibrary, notifier } = useContext(RootAppStoreContext)
	const [uploading, setUploading] = useState(false)
	const [showNameEditModal, setShowNameEditModal] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const confirmModalRef = useRef<GenericConfirmModalRef>(null)

	// Get image info from the store
	const imageInfo = selectedImageName ? imageLibrary.getImage(selectedImageName) : null

	const deleteMutation = useMutationExt(trpc.imageLibrary.delete.mutationOptions())

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
					// Create download link
					const link = document.createElement('a')
					link.href = imageData.image
					link.download = `${imageInfo.name}.${imageInfo.mimeType.split('/')[1] || 'png'}`
					document.body.appendChild(link)
					link.click()
					document.body.removeChild(link)
				}
			})
			.catch((err) => {
				console.error('Failed to download image:', err)
			})
	}, [selectedImageName, imageInfo])

	const startUploadMutation = useMutationExt(trpc.imageLibrary.upload.start.mutationOptions())
	const uploadChunkMutation = useMutationExt(trpc.imageLibrary.upload.uploadChunk.mutationOptions())
	const completeUploadMutation = useMutationExt(trpc.imageLibrary.upload.complete.mutationOptions())

	const handleReplaceImage = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.currentTarget.files?.[0]
			event.currentTarget.value = '' // Reset file input

			if (!file || !selectedImageName) return

			setUploading(true)

			const uploadFile = async () => {
				try {
					// Convert file to data URL and upload
					const dataUrl = await blobToDataURL(file)
					const data = new TextEncoder().encode(dataUrl)

					const hasher = CryptoJS.algo.SHA1.create()
					hasher.update(CryptoJS.lib.WordArray.create(data))
					const checksum = hasher.finalize().toString(CryptoJS.enc.Hex)

					// Start upload
					const sessionId = await startUploadMutation.mutateAsync({
						name: file.name,
						size: data.byteLength,
					})
					if (!sessionId) throw new Error('Failed to start upload')

					// Upload the file in 1MB chunks
					const CHUNK_SIZE = 1024 * 1024 // 1MB
					const totalChunks = Math.ceil(data.length / CHUNK_SIZE)

					for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
						const start = chunkIndex * CHUNK_SIZE
						const end = Math.min(start + CHUNK_SIZE, data.length)
						const chunk = data.slice(start, end)

						await uploadChunkMutation.mutateAsync({
							sessionId,
							offset: start,
							data: base64EncodeUint8Array(chunk),
						})
					}

					// Complete upload
					await completeUploadMutation.mutateAsync({
						sessionId,
						expectedChecksum: checksum,
						userData: { imageName: selectedImageName }, // Pass the image name as user data
					})

					// The store will be updated automatically via subscription
				} catch (err) {
					console.error('Failed to replace image:', err)
				} finally {
					setUploading(false)
				}
			}

			void uploadFile()
		},
		[startUploadMutation, uploadChunkMutation, completeUploadMutation, selectedImageName]
	)

	const handleImageNameChanged = useCallback(
		(oldName: string, newName: string) => {
			setShowNameEditModal(false)
			if (onImageNameChanged) {
				onImageNameChanged(oldName, newName)
			}
		},
		[onImageNameChanged]
	)

	const handleCopyVariableValue = useCallback(() => {
		notifier.show('Copied', 'Copied to clipboard', 5000)
	}, [notifier])

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleString()
	}

	if (!selectedImageName) {
		return (
			<div className="image-library-editor">
				<CAlert color="info">Select an image from the library to view and edit its properties.</CAlert>
			</div>
		)
	}

	if (!imageInfo) {
		return (
			<div className="image-library-editor">
				<CAlert color="danger">Failed to load image data.</CAlert>
			</div>
		)
	}

	return (
		<div className="image-library-editor">
			<GenericConfirmModal ref={confirmModalRef} />

			<ImageNameEditModal
				visible={showNameEditModal}
				onClose={() => setShowNameEditModal(false)}
				imageName={selectedImageName}
				currentName={imageInfo.name}
				onNameChanged={handleImageNameChanged}
			/>

			<div className="mb-3">
				<div className="d-flex flex-wrap gap-2">
					<CButton color="danger" onClick={handleDelete} title="Delete Image">
						<FontAwesomeIcon icon={faTrashAlt} />
					</CButton>

					<CButton color="secondary" onClick={handleDownload}>
						<FontAwesomeIcon icon={faDownload} /> Download
					</CButton>

					<CButton color="warning" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
						<FontAwesomeIcon icon={faUpload} />
						{uploading ? ' Replacing...' : ' Replace'}
					</CButton>
				</div>

				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					onChange={handleReplaceImage}
					style={{ display: 'none' }}
				/>
			</div>

			<CForm className="row mb-3">
				<CFormLabel htmlFor="inputName" className="col-sm-4 col-form-label col-form-label-sm">
					Name
				</CFormLabel>
				<CCol sm={8} className="d-flex align-items-center justify-content-between">
					<div className="d-flex align-items-center">
						<span className="font-monospace">{imageInfo.name}</span>
						<CopyToClipboard text={`$(image:${imageInfo.name})`} onCopy={handleCopyVariableValue}>
							<CButton size="sm" title="Copy variable name">
								<FontAwesomeIcon icon={faCopy} />
							</CButton>
						</CopyToClipboard>
					</div>
					<CButton color="secondary" size="sm" onClick={() => setShowNameEditModal(true)} title="Edit Image name">
						<FontAwesomeIcon icon={faEdit} />
					</CButton>
				</CCol>
			</CForm>
			<CForm className="row mb-3">
				<CFormLabel htmlFor="inputName" className="col-sm-4 col-form-label col-form-label-sm">
					Description
				</CFormLabel>
				<CCol sm={8}>
					<ImageDescriptionEditor imageName={selectedImageName} currentName={imageInfo.description} />
				</CCol>
			</CForm>

			<div className="image-preview-full">
				<ImageLibraryImagePreview
					imageName={selectedImageName}
					type="original"
					checksum={imageInfo.checksum}
					alt={imageInfo.name}
				/>
			</div>

			<div className="image-properties">
				<div className="image-metadata">
					<div className="metadata-row">
						<span className="metadata-label">Type:</span>
						<span>{imageInfo.mimeType}</span>
					</div>
					<div className="metadata-row">
						<span className="metadata-label">Modified:</span>
						<span>{formatDate(imageInfo.modifiedAt)}</span>
					</div>
				</div>
			</div>
		</div>
	)
})
