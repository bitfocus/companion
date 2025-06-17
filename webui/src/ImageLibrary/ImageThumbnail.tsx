import React, { useContext, useEffect, useState } from 'react'
import { SocketContext } from '~/util.js'
import type { ImageLibraryInfo } from '@companion-app/shared/Model/ImageLibraryModel.js'
import classNames from 'classnames'

interface ImageThumbnailProps {
	image: ImageLibraryInfo
	selected: boolean
	onClick: () => void
}

export function ImageThumbnail({ image, selected, onClick }: ImageThumbnailProps) {
	const socket = useContext(SocketContext)
	const [previewUrl, setPreviewUrl] = useState<string | null>(null)

	useEffect(() => {
		socket
			.emitPromise('image-library:get-data', [image.id, 'preview'])
			.then((dataUrl) => {
				setPreviewUrl(dataUrl)
			})
			.catch((err) => {
				console.error('Failed to load image preview:', err)
			})
	}, [socket, image.id])

	const formatFileSize = (bytes: number) => {
		if (bytes === 0) return '0 B'
		const k = 1024
		const sizes = ['B', 'KB', 'MB']
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
	}

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleDateString()
	}

	return (
		<div className={classNames('image-thumbnail', { selected })} onClick={onClick}>
			<div className="image-preview">
				{previewUrl ? (
					<img src={previewUrl} alt={image.name} />
				) : (
					<div className="image-placeholder">
						<span>Loading...</span>
					</div>
				)}
			</div>
			<div className="image-info">
				<div className="image-name" title={image.name}>
					{image.name}
				</div>
				<div className="image-details">
					<small>{formatFileSize(image.originalSize)}</small>
					<small>{formatDate(image.modifiedAt)}</small>
				</div>
			</div>
		</div>
	)
}
