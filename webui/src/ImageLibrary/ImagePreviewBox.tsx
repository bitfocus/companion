import classNames from 'classnames'
import { useCallback, useState } from 'react'

interface ImagePreviewBoxProps {
	children?: React.ReactNode
	src?: string | null
	onFileDrop?: (file: File) => void
	dragOverMessage?: string
	className?: string
}

export function ImagePreviewBox({
	children,
	src,
	onFileDrop,
	dragOverMessage = 'Drop image here',
	className,
}: ImagePreviewBoxProps): JSX.Element {
	const [isDragOver, setIsDragOver] = useState(false)

	const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault()
		e.stopPropagation()
		setIsDragOver(true)
	}, [])

	const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault()
		e.stopPropagation()
		setIsDragOver(false)
	}, [])

	const handleDrop = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			e.preventDefault()
			e.stopPropagation()
			setIsDragOver(false)
			if (!onFileDrop) return
			const file = e.dataTransfer.files[0]
			if (file?.type.startsWith('image/')) {
				onFileDrop(file)
			}
		},
		[onFileDrop]
	)

	return (
		<div
			className={classNames('image-preview-full', { 'drag-over': isDragOver }, className)}
			onDragOver={onFileDrop ? handleDragOver : undefined}
			onDragLeave={onFileDrop ? handleDragLeave : undefined}
			onDrop={onFileDrop ? handleDrop : undefined}
		>
			{src && <img src={src} alt="Preview" />}
			{children}
			{isDragOver && (
				<div className="drag-overlay">
					<div className="drag-overlay-message">{dragOverMessage}</div>
				</div>
			)}
		</div>
	)
}
