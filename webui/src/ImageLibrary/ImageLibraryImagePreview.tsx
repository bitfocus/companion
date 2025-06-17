import React, { useContext, useEffect, useState, useRef } from 'react'
import { SocketContext } from '~/util.js'
import classNames from 'classnames'

interface ImageLibraryImagePreviewProps {
	imageId: string
	type: 'original' | 'preview'
	checksum: string
	className?: string
	alt?: string
	onLoad?: () => void
	onError?: (error: string) => void
}

interface LoadState {
	loading: boolean
	imageUrl: string | null
	error: string | null
	loadedChecksum: string | null
}

export function ImageLibraryImagePreview({
	imageId,
	type,
	checksum,
	className,
	alt,
}: ImageLibraryImagePreviewProps): JSX.Element {
	const socket = useContext(SocketContext)
	const [loadState, setLoadState] = useState<LoadState>({
		loading: false,
		imageUrl: null,
		error: null,
		loadedChecksum: null,
	})

	// Use ref to track the current request to handle race conditions
	const currentRequestRef = useRef<{
		imageId: string
		type: 'original' | 'preview'
		checksum: string
	} | null>(null)

	useEffect(() => {
		// If checksum hasn't changed and we already have the image, don't reload
		if (loadState.loadedChecksum === checksum && loadState.imageUrl && !loadState.error) {
			return
		}

		// Set up the current request tracking
		const requestKey = { imageId, type, checksum }
		currentRequestRef.current = requestKey

		setLoadState((prev) => ({
			...prev,
			loading: true,
			error: null,
		}))

		socket
			.emitPromise('image-library:get-data', [imageId, type])
			.then((response) => {
				// Check if this response is for the current request (race condition protection)
				if (
					currentRequestRef.current?.imageId === imageId &&
					currentRequestRef.current?.type === type &&
					currentRequestRef.current?.checksum === checksum
				) {
					const imageData = response as { image: string; checksum: string } | null

					if (imageData) {
						// Verify the checksum matches what we expected
						if (imageData.checksum === checksum) {
							setLoadState({
								loading: false,
								imageUrl: imageData.image,
								error: null,
								loadedChecksum: checksum,
							})
						} else {
							// Checksum mismatch - image was updated while we were loading
							const errorMsg = 'Image was updated while loading'
							setLoadState({
								loading: false,
								imageUrl: null,
								error: errorMsg,
								loadedChecksum: null,
							})
						}
					} else {
						const errorMsg = 'Image not found or has no data'
						setLoadState({
							loading: false,
							imageUrl: null,
							error: errorMsg,
							loadedChecksum: null,
						})
					}
				}
				// If request doesn't match current, ignore it (race condition handled)
			})
			.catch((err) => {
				// Check if this error is for the current request
				if (
					currentRequestRef.current?.imageId === imageId &&
					currentRequestRef.current?.type === type &&
					currentRequestRef.current?.checksum === checksum
				) {
					const errorMsg = err instanceof Error ? err.message : 'Failed to load image'
					setLoadState({
						loading: false,
						imageUrl: null,
						error: errorMsg,
						loadedChecksum: null,
					})
				}
			})

		// Cleanup function
		return () => {
			// Clear the current request if it matches this effect
			if (
				currentRequestRef.current?.imageId === imageId &&
				currentRequestRef.current?.type === type &&
				currentRequestRef.current?.checksum === checksum
			) {
				currentRequestRef.current = null
			}
		}
	}, [socket, imageId, type, checksum, loadState.loadedChecksum, loadState.imageUrl, loadState.error])

	if (loadState.loading) {
		return (
			<div className={classNames('image-library-preview-loading', className)}>
				<span>Loading...</span>
			</div>
		)
	}

	if (loadState.error) {
		return (
			<div className={classNames('image-library-preview-error', className)}>
				<span>{loadState.error}</span>
			</div>
		)
	}

	if (!loadState.imageUrl) {
		return (
			<div className={classNames('image-library-preview-empty', className)}>
				<span>No image data</span>
			</div>
		)
	}

	return (
		<img
			src={loadState.imageUrl}
			alt={alt || 'Image preview'}
			className={classNames('image-library-preview', className)}
		/>
	)
}
