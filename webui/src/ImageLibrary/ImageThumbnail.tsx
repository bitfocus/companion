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
	return (
		<div className={classNames('image-thumbnail', { selected })} onClick={onClick}>
			<div className="image-preview">
				<ImageLibraryImagePreview imageId={image.id} type="preview" checksum={image.checksum} alt={image.name} />
			</div>
			<div className="p-2">
				<div className="image-name" title={image.name}>
					{image.name}
				</div>
				<div className="image-id" title={image.id}>
					{image.id}
				</div>
			</div>
		</div>
	)
}
