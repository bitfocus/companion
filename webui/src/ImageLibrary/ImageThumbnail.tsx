import React from 'react'
import type { ImageLibraryInfo } from '@companion-app/shared/Model/ImageLibraryModel.js'
import classNames from 'classnames'
import { ImageLibraryImagePreview } from './ImageLibraryImagePreview.js'

interface ImageThumbnailProps {
	image: ImageLibraryInfo
	selected: boolean
	onClick: () => void
}

export function ImageThumbnail({ image, selected, onClick }: ImageThumbnailProps): JSX.Element {
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
				<ImageLibraryImagePreview imageId={image.id} type="preview" checksum={image.checksum} alt={image.name} />
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
