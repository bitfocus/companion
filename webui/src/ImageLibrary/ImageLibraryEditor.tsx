import { CAlert, CButton, CFormInput, CSpinner } from '@coreui/react'
import { faDownload, faTrash, faUpload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { SocketContext } from '~/util.js'
import { observer } from 'mobx-react-lite'
import type { ImageLibraryInfo } from '@companion-app/shared/Model/ImageLibraryModel.js'
import { blobToDataURL } from '~/Helpers/FileUpload.js'

interface ImageLibraryEditorProps {
	selectedImageId: string | null
	onDeleteImage: (imageId: string) => void
}

export const ImageLibraryEditor = observer(function ImageLibraryEditor({
	selectedImageId,
	onDeleteImage,
}: ImageLibraryEditorProps) {
	const socket = useContext(SocketContext)
	const [imageInfo, setImageInfo] = useState<ImageLibraryInfo | null>(null)
	const [imageUrl, setImageUrl] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [saving, setSaving] = useState(false)
	const [uploading, setUploading] = useState(false)
	const [imageName, setImageName] = useState('')
	const fileInputRef = useRef<HTMLInputElement>(null)

	// Load image data when selection changes
	useEffect(() => {
		if (!selectedImageId) {
			setImageInfo(null)
			setImageUrl(null)
			setImageName('')
			return
		}

		setLoading(true)

		Promise.all([
			socket.emitPromise('image-library:get-info', [selectedImageId]),
			socket.emitPromise('image-library:get-data', [selectedImageId, 'original']),
		])
			.then(([info, dataUrl]) => {
				setImageInfo(info)
				setImageUrl(dataUrl)
				setImageName(info?.name || '')
			})
			.catch((err) => {
				console.error('Failed to load image data:', err)
				setImageInfo(null)
				setImageUrl(null)
				setImageName('')
			})
			.finally(() => {
				setLoading(false)
			})
	}, [socket, selectedImageId])

	const handleSaveName = useCallback(() => {
		if (!selectedImageId || !imageName.trim()) return

		setSaving(true)
		socket
			.emitPromise('image-library:set-name', [selectedImageId, imageName.trim()])
			.then(() => {
				// Update local state
				if (imageInfo) {
					setImageInfo({ ...imageInfo, name: imageName.trim() })
				}
			})
			.catch((err) => {
				console.error('Failed to save image name:', err)
			})
			.finally(() => {
				setSaving(false)
			})
	}, [socket, selectedImageId, imageName, imageInfo])

	const handleDelete = useCallback(() => {
		if (!selectedImageId) return

		if (confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
			socket
				.emitPromise('image-library:delete', [selectedImageId])
				.then(() => {
					onDeleteImage(selectedImageId)
				})
				.catch((err) => {
					console.error('Failed to delete image:', err)
				})
		}
	}, [socket, selectedImageId, onDeleteImage])

	const handleDownload = useCallback(() => {
		if (!imageUrl || !imageInfo) return

		// Create download link
		const link = document.createElement('a')
		link.href = imageUrl
		link.download = `${imageInfo.name}.${imageInfo.mimeType.split('/')[1] || 'jpg'}`
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
	}, [imageUrl, imageInfo])

	const handleReplaceImage = useCallback(async () => {
		if (!fileInputRef.current?.files?.[0] || !selectedImageId) return

		const file = fileInputRef.current.files[0]
		setUploading(true)

		try {
			// Convert file to data URL and upload
			const dataUrl = await blobToDataURL(file)

			// Start upload
			const sessionId = await socket.emitPromise('image-library:upload-start', [file.name, file.size])

			// Upload the file as a single chunk (for simplicity)
			const response = await fetch(dataUrl)
			const buffer = await response.arrayBuffer()
			const data = new Uint8Array(buffer)

			await socket.emitPromise('image-library:upload-chunk', [sessionId, 0, data])

			// Complete upload
			await socket.emitPromise('image-library:upload-complete', [sessionId, selectedImageId, 'dummy-checksum'])

			// Reload the image
			const [info, newDataUrl] = await Promise.all([
				socket.emitPromise('image-library:get-info', [selectedImageId]),
				socket.emitPromise('image-library:get-data', [selectedImageId, 'original']),
			])

			setImageInfo(info)
			setImageUrl(newDataUrl)
		} catch (err) {
			console.error('Failed to replace image:', err)
		} finally {
			setUploading(false)
			if (fileInputRef.current) {
				fileInputRef.current.value = ''
			}
		}
	}, [socket, selectedImageId])

	const formatFileSize = (bytes: number) => {
		if (bytes === 0) return '0 B'
		const k = 1024
		const sizes = ['B', 'KB', 'MB']
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
	}

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleString()
	}

	if (!selectedImageId) {
		return (
			<div className="image-library-editor">
				<h5>Image Editor</h5>
				<CAlert color="info">Select an image from the library to view and edit its properties.</CAlert>
			</div>
		)
	}

	if (loading) {
		return (
			<div className="image-library-editor">
				<h5>Image Editor</h5>
				<div className="text-center p-4">
					<CSpinner />
				</div>
			</div>
		)
	}

	if (!imageInfo) {
		return (
			<div className="image-library-editor">
				<h5>Image Editor</h5>
				<CAlert color="danger">Failed to load image data.</CAlert>
			</div>
		)
	}

	return (
		<div className="image-library-editor">
			<h5>Image Editor</h5>

			<div className="image-preview-full">
				{imageUrl ? (
					<img src={imageUrl} alt={imageInfo.name} />
				) : (
					<div className="image-placeholder">
						<span>No image data</span>
					</div>
				)}
			</div>

			<div className="image-properties">
				<div className="form-group mb-3">
					<label className="form-label">Name</label>
					<div className="d-flex gap-2">
						<CFormInput
							type="text"
							value={imageName}
							onChange={(e) => setImageName(e.target.value)}
							disabled={saving}
						/>
						<CButton
							color="primary"
							onClick={handleSaveName}
							disabled={saving || !imageName.trim() || imageName.trim() === imageInfo.name}
						>
							{saving ? <CSpinner size="sm" /> : 'Save'}
						</CButton>
					</div>
				</div>

				<div className="image-metadata">
					<div className="metadata-row">
						<span className="metadata-label">File Size:</span>
						<span>{formatFileSize(imageInfo.originalSize)}</span>
					</div>
					<div className="metadata-row">
						<span className="metadata-label">Type:</span>
						<span>{imageInfo.mimeType}</span>
					</div>
					<div className="metadata-row">
						<span className="metadata-label">Created:</span>
						<span>{formatDate(imageInfo.createdAt)}</span>
					</div>
					<div className="metadata-row">
						<span className="metadata-label">Modified:</span>
						<span>{formatDate(imageInfo.modifiedAt)}</span>
					</div>
					<div className="metadata-row">
						<span className="metadata-label">Checksum:</span>
						<span className="text-muted small">{imageInfo.checksum}</span>
					</div>
				</div>

				<div className="image-actions mt-4">
					<div className="d-flex flex-wrap gap-2">
						<CButton color="secondary" onClick={handleDownload}>
							<FontAwesomeIcon icon={faDownload} /> Download
						</CButton>

						<CButton color="warning" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
							<FontAwesomeIcon icon={faUpload} />
							{uploading ? ' Replacing...' : ' Replace'}
						</CButton>

						<CButton color="danger" onClick={handleDelete}>
							<FontAwesomeIcon icon={faTrash} /> Delete
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
			</div>
		</div>
	)
})
