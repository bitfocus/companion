import { CAlert, CButton, CCol, CForm, CFormLabel } from '@coreui/react'
import { faDownload, faTrashAlt, faUpload, faEdit, faCopy } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useRef, useState } from 'react'
import { SocketContext } from '~/util.js'
import { observer } from 'mobx-react-lite'
import { blobToDataURL } from '~/Helpers/FileUpload.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ImageLibraryImagePreview } from './ImageLibraryImagePreview.js'
import { ImageNameEditor } from './ImageNameEditor.js'
import { ImageIdEditModal } from './ImageIdEditModal.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import CryptoJS from 'crypto-js'
import { CopyToClipboard } from 'react-copy-to-clipboard'

interface ImageLibraryEditorProps {
	selectedImageId: string | null
	onDeleteImage: (imageId: string) => void
	onImageIdChanged?: (oldId: string, newId: string) => void
}

export const ImageLibraryEditor = observer(function ImageLibraryEditor({
	selectedImageId,
	onDeleteImage,
	onImageIdChanged,
}: ImageLibraryEditorProps) {
	const socket = useContext(SocketContext)
	const { imageLibrary, notifier } = useContext(RootAppStoreContext)
	const [uploading, setUploading] = useState(false)
	const [showIdEditModal, setShowIdEditModal] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const confirmModalRef = useRef<GenericConfirmModalRef>(null)

	// Get image info from the store
	const imageInfo = selectedImageId ? imageLibrary.getImage(selectedImageId) : null

	const handleDelete = useCallback(() => {
		if (!selectedImageId) return

		confirmModalRef.current?.show(
			'Delete Image',
			'Are you sure you want to delete this image? This action cannot be undone.',
			'Delete',
			() => {
				socket
					.emitPromise('image-library:delete', [selectedImageId])
					.then(() => {
						onDeleteImage(selectedImageId)
					})
					.catch((err) => {
						console.error('Failed to delete image:', err)
					})
			}
		)
	}, [socket, selectedImageId, onDeleteImage])

	const handleDownload = useCallback(() => {
		if (!selectedImageId || !imageInfo) return

		// Get image data and download
		socket
			.emitPromise('image-library:get-data', [selectedImageId, 'original'])
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
	}, [socket, selectedImageId, imageInfo])

	const handleReplaceImage = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.currentTarget.files?.[0]
			event.currentTarget.value = null as any

			if (!file || !selectedImageId) return

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
					const sessionId = await socket.emitPromise('image-library:upload-start', [file.name, data.length])

					// Upload the file in 1MB chunks
					const CHUNK_SIZE = 1024 * 1024 // 1MB
					const totalChunks = Math.ceil(data.length / CHUNK_SIZE)

					for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
						const start = chunkIndex * CHUNK_SIZE
						const end = Math.min(start + CHUNK_SIZE, data.length)
						const chunk = data.slice(start, end)

						await socket.emitPromise('image-library:upload-chunk', [sessionId, chunkIndex, chunk])
					}

					// Complete upload
					await socket.emitPromise('image-library:upload-complete', [sessionId, selectedImageId, checksum])

					// The store will be updated automatically via subscription
				} catch (err) {
					console.error('Failed to replace image:', err)
				} finally {
					setUploading(false)
				}
			}

			void uploadFile()
		},
		[socket, selectedImageId]
	)

	const handleImageIdChanged = useCallback(
		(oldId: string, newId: string) => {
			setShowIdEditModal(false)
			if (onImageIdChanged) {
				onImageIdChanged(oldId, newId)
			}
		},
		[onImageIdChanged]
	)

	const handleCopyVariableValue = useCallback(() => {
		if (notifier.current && selectedImageId) {
			notifier.current.show('Copied', 'Copied to clipboard', 5000)
		}
	}, [notifier, selectedImageId])

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleString()
	}

	if (!selectedImageId) {
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

			<ImageIdEditModal
				visible={showIdEditModal}
				onClose={() => setShowIdEditModal(false)}
				imageId={selectedImageId}
				currentId={imageInfo.id}
				onIdChanged={handleImageIdChanged}
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
				<CFormLabel htmlFor="inputId" className="col-sm-4 col-form-label col-form-label-sm">
					Id
				</CFormLabel>
				<CCol sm={8} className="d-flex align-items-center justify-content-between">
					<div className="d-flex align-items-center">
						<span className="font-monospace">{imageInfo.id}</span>
						<CopyToClipboard text={`$(image:${imageInfo.id})`} onCopy={handleCopyVariableValue}>
							<CButton size="sm" title="Copy variable name">
								<FontAwesomeIcon icon={faCopy} />
							</CButton>
						</CopyToClipboard>
					</div>
					<CButton color="secondary" size="sm" onClick={() => setShowIdEditModal(true)} title="Edit Image ID">
						<FontAwesomeIcon icon={faEdit} />
					</CButton>
				</CCol>
			</CForm>
			<CForm className="row mb-3">
				<CFormLabel htmlFor="inputName" className="col-sm-4 col-form-label col-form-label-sm">
					Name
				</CFormLabel>
				<CCol sm={8}>
					<ImageNameEditor imageId={selectedImageId} currentName={imageInfo.name} />
				</CCol>
			</CForm>

			<div className="image-preview-full">
				<ImageLibraryImagePreview
					imageId={selectedImageId}
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
