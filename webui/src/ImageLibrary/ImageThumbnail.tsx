import classNames from 'classnames'
import { useCallback } from 'react'
import type { ImageLibraryInfo } from '@companion-app/shared/Model/ImageLibraryModel.js'
import { ImageLibraryImagePreview } from './ImageLibraryImagePreview.js'

interface ImageThumbnailProps {
	image: ImageLibraryInfo
	selected: boolean
	onClick: () => void
}

export function ImageThumbnail({ image, selected, onClick }: ImageThumbnailProps): JSX.Element {
	const onKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault()
				onClick()
			}
		},
		[onClick]
	)

	return (
		<div
			className={classNames('image-thumbnail', { selected })}
			role="button"
			tabIndex={0}
			onClick={onClick}
			onKeyDown={onKeyDown}
		>
			<div className="image-preview">
				<ImageLibraryImagePreview
					imageName={image.name}
					type="preview"
					checksum={image.checksum}
					alt={image.description}
				/>
			</div>
			<div className="p-2">
				<div className="image-name" title={image.description}>
					{image.description}
				</div>
				<div className="image-id" title={image.name}>
					{image.name}
				</div>
			</div>
		</div>
	)
}
