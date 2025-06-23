import React, { useContext, useEffect, useState } from 'react'
import { SocketContext } from '~/util.js'
import classNames from 'classnames'
import { MoonLoader } from 'react-spinners'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImage } from '@fortawesome/free-solid-svg-icons'
import { useImageCache } from './ImageCache.js'

interface ImageLibraryImagePreviewProps {
	imageName: string
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
}

export function ImageLibraryImagePreview({
	imageName,
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
	})

	useEffect(() => {
		// Check if we have a cached image URL first
		const cacheKey = imageCache?.generateKey(imageName, type, checksum)
		const cachedUrl = cacheKey && imageCache?.get(cacheKey)

		if (typeof cachedUrl === 'string') {
			// Use cached URL immediately
			setLoadState({
				loading: false,
				imageUrl: cachedUrl,
				error: null,
			})
			return
		}

		// Track whether the load is aborted
		let abort = false

		setLoadState({
			loading: true,
			imageUrl: null,
			error: null,
		})

		socket
			.emitPromise('image-library:get-data', [imageName, type])
			.then((response) => {
				if (abort) return // Ignore if we were aborted
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
						})
					} else {
						// Checksum mismatch - image was updated while we were loading
						const errorMsg = 'Image was updated while loading'
						setLoadState({
							loading: false,
							imageUrl: null,
							error: errorMsg,
						})
					}
				} else {
					const errorMsg = 'Image not found'
					setLoadState({
						loading: false,
						imageUrl: null,
						error: errorMsg,
					})
				}
			})
			.catch((err) => {
				if (abort) return // Ignore if we were aborted

				const errorMsg = err instanceof Error ? err.message : 'Failed to load image'
				setLoadState({
					loading: false,
					imageUrl: null,
					error: errorMsg,
				})
			})

		// Cleanup function
		return () => {
			abort = true
		}
	}, [socket, imageName, type, checksum, imageCache])

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
