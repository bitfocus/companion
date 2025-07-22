import React, { useEffect } from 'react'
import classNames from 'classnames'
import { MoonLoader } from 'react-spinners'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImage } from '@fortawesome/free-solid-svg-icons'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '~/Resources/TRPC'

interface ImageLibraryImagePreviewProps {
	imageName: string
	type: 'original' | 'preview'
	checksum: string
	className?: string
	alt?: string
	onLoad?: () => void
	onError?: (error: string) => void
}

// interface LoadState {
// 	loading: boolean
// 	imageUrl: string | null
// 	error: string | null
// }

export function ImageLibraryImagePreview({
	imageName,
	type,
	checksum,
	className,
	alt,
}: ImageLibraryImagePreviewProps): JSX.Element {
	const {
		data: queryData,
		isLoading: queryLoading,
		error: queryError,
		refetch: queryRefetch,
	} = useQuery(
		trpc.imageLibrary.getData.queryOptions({
			imageName,
			type,
		})
	)

	useEffect(() => {
		queryRefetch().catch((err) => {
			console.error('Failed to refetch image data:', err)
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [imageName, type, checksum])

	const checksumMatches = !queryData || queryData.checksum === checksum

	if (queryLoading || !checksumMatches) {
		return (
			<div className={classNames('image-library-preview-loading', className)}>
				<MoonLoader />
			</div>
		)
	}

	if (queryError) {
		return (
			<div className={classNames('image-library-preview-error', className)}>
				<span>{queryError.message}</span>
			</div>
		)
	}

	if (!queryData?.image) {
		return (
			<div className={classNames('image-library-preview-empty', className)}>
				<FontAwesomeIcon icon={faImage} title="No image data" />
			</div>
		)
	}

	return (
		<img
			src={queryData.image}
			alt={alt || 'Image preview'}
			className={classNames('image-library-preview', className)}
		/>
	)
}
