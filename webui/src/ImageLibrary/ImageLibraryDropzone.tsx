import { faFileUpload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useContext, useState, useEffect, useCallback } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { useImageLibraryUpload } from './useImageLibraryUpload'
import { nanoid } from 'nanoid'

export function ImageLibraryDropzone(): React.ReactElement | null {
	const { notifier } = useContext(RootAppStoreContext)
	const [isDragOver, setIsDragOver] = useState(false)
	const [isUploading, setIsUploading] = useState(false)

	const createMutation = useMutationExt(trpc.imageLibrary.create.mutationOptions())
	const { uploadImageFile } = useImageLibraryUpload()

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			e.stopPropagation()
			setIsDragOver(false)

			const files = e.dataTransfer?.files
			if (!files || files.length === 0) return

			// Filter for image files only
			const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))

			if (imageFiles.length === 0) {
				notifier.show('Invalid Files', 'Please drop image files only', 5000)
				return
			}

			setIsUploading(true)

			void (async () => {
				try {
					for (const file of imageFiles) {
						// Generate a random ID for the image
						const imageName = nanoid()

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
				} finally {
					setIsUploading(false)
				}
			})()
		},
		[createMutation, uploadImageFile, notifier]
	)

	// Detect drags at window level to show overlay
	useEffect(() => {
		let dragCounter = 0

		const handleWindowDragEnter = (e: DragEvent) => {
			const items = e.dataTransfer?.items
			if (items && Array.from(items).some((item) => item.kind === 'file')) {
				dragCounter++
				setIsDragOver(true)
			}
		}

		const handleWindowDragLeave = () => {
			dragCounter--
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
