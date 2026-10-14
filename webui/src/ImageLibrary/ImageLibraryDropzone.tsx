import { faFileUpload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useEffect, useState } from 'react'
import { useUploadImageFiles } from './useUploadImageFiles'

export function ImageLibraryDropzone(): React.ReactElement | null {
	const [isDragOver, setIsDragOver] = useState(false)
	const [isUploading, setIsUploading] = useState(false)

	const uploadImageFiles = useUploadImageFiles()

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			e.stopPropagation()
			setIsDragOver(false)

			const files = e.dataTransfer?.files
			if (!files || files.length === 0) return

			setIsUploading(true)
			void uploadImageFiles(Array.from(files)).finally(() => setIsUploading(false))
		},
		[uploadImageFiles]
	)

	// Detect drags at window level to show overlay
	useEffect(() => {
		let dragCounter = 0

		const handleWindowDragEnter = (e: DragEvent) => {
			e.preventDefault()

			const items = e.dataTransfer?.items
			if (items && Array.from(items).some((item) => item.kind === 'file')) {
				dragCounter++
				setIsDragOver(true)
			}
		}

		const handleWindowDragLeave = (e: DragEvent) => {
			e.preventDefault()

			const items = e.dataTransfer?.items
			if (!items || !Array.from(items).some((item) => item.kind === 'file')) return
			dragCounter = Math.max(0, dragCounter - 1)
			if (dragCounter === 0) {
				setIsDragOver(false)
			}
		}

		const handleWindowDragOver = (e: DragEvent) => {
			e.preventDefault()
		}

		const handleWindowDrop = (e: DragEvent) => {
			e.preventDefault()
			dragCounter = 0
			setIsDragOver(false)
		}

		const handleDragEnd = () => {
			// Drag operation ended (cancelled or completed outside window)
			dragCounter = 0
			setIsDragOver(false)
		}

		window.addEventListener('dragenter', handleWindowDragEnter)
		window.addEventListener('dragleave', handleWindowDragLeave)
		window.addEventListener('dragover', handleWindowDragOver)
		window.addEventListener('drop', handleWindowDrop)
		window.addEventListener('dragend', handleDragEnd)

		return () => {
			window.removeEventListener('dragenter', handleWindowDragEnter)
			window.removeEventListener('dragleave', handleWindowDragLeave)
			window.removeEventListener('dragover', handleWindowDragOver)
			window.removeEventListener('drop', handleWindowDrop)
			window.removeEventListener('dragend', handleDragEnd)
		}
	}, [])

	if (!isDragOver && !isUploading) return null

	return (
		<div
			className={`image-library-dropzone ${isDragOver ? 'active' : ''} ${isUploading ? 'uploading' : ''}`}
			onDrop={handleDrop}
			onDragOver={(e) => e.preventDefault()}
		>
			<div className="dropzone-content">
				<FontAwesomeIcon icon={faFileUpload} size="2x" />
				<span>{isUploading ? 'Uploading...' : 'Upload as new images'}</span>
			</div>
		</div>
	)
}
