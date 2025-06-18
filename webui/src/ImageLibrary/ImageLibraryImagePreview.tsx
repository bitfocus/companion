import React, { useContext, useEffect, useState, useRef } from 'react'
import { SocketContext } from '~/util.js'
import classNames from 'classnames'
import { MoonLoader } from 'react-spinners'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImage } from '@fortawesome/free-solid-svg-icons'
import { useImageCache } from './ImageCache.js'

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
	const imageCache = useImageCache()
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

	// Use a ref to store the last loaded combination to avoid re-triggering loads
	const lastLoadedRef = useRef<string>('')

	useEffect(() => {
		const loadKey = `${imageId}-${type}-${checksum}`

		// If we've already loaded this exact combination, don't reload
		if (lastLoadedRef.current === loadKey) {
			return
		}

		// Check if we have a cached image URL first
		const cacheKey = imageCache?.generateKey(imageId, type, checksum)
		const cachedUrl = cacheKey && imageCache?.get(cacheKey)

		if (typeof cachedUrl === 'string') {
			// Use cached URL immediately
			setLoadState({
				loading: false,
				imageUrl: cachedUrl,
				error: null,
				loadedChecksum: checksum,
			})
			lastLoadedRef.current = loadKey
			return
		}

		// Set up the current request tracking
		const requestKey = { imageId, type, checksum }
		currentRequestRef.current = requestKey

		setLoadState({
			loading: true,
			imageUrl: null,
			error: null,
			loadedChecksum: null,
		})

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
							// Cache the image URL for future use
							if (cacheKey) imageCache?.set(cacheKey, imageData.image)

							setLoadState({
								loading: false,
								imageUrl: imageData.image,
								error: null,
								loadedChecksum: checksum,
							})
							lastLoadedRef.current = loadKey
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
						const errorMsg = 'Image not found'
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
	}, [socket, imageId, type, checksum, imageCache])

	if (loadState.loading) {
		return (
			<div className={classNames('image-library-preview-loading', className)}>
				<MoonLoader />
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
				<FontAwesomeIcon icon={faImage} title="No image data" />
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
