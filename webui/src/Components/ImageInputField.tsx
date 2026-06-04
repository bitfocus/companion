import { faExclamationTriangle, faImage, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useQuery } from '@tanstack/react-query'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useContext, useEffect, useRef } from 'react'
import { MoonLoader } from 'react-spinners'
import { Button, ButtonGroup } from '~/Components/Button'
import { trpc } from '~/Resources/TRPC'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ImagePickerModal, type ImagePickerModalRef } from './ImagePickerModal.js'

interface MinMaxDimension {
	width: number
	height: number
}

interface ImageInputFieldProps {
	id: string | undefined
	value: string | null
	setValue: (value: string | null) => void
	disabled?: boolean
	min?: MinMaxDimension
	max?: MinMaxDimension
}

interface LibraryImageThumbnailProps {
	imageName: string
	checksum: string
}
function LibraryImageThumbnail({ imageName, checksum }: LibraryImageThumbnailProps): React.JSX.Element {
	const { data, isLoading, error, refetch } = useQuery(
		trpc.imageLibrary.getData.queryOptions({ imageName, type: 'preview' })
	)

	useEffect(() => {
		refetch().catch((err) => console.error('Failed to refetch image data:', err))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [imageName, checksum])

	const checksumMatches = !data || data.checksum === checksum

	if (isLoading || !checksumMatches) {
		return <MoonLoader size={20} />
	}
	if (error || !data?.image) {
		return <FontAwesomeIcon icon={faExclamationTriangle} aria-label={error?.message ?? 'No image data'} />
	}
	return <img src={data.image} alt="Library image" />
}

const LIBRARY_PREFIX = '$(image:'

function parseValue(
	value: string | null
): { type: 'none' } | { type: 'library'; id: string } | { type: 'inline'; dataUrl: string } {
	if (!value) return { type: 'none' }
	if (value.startsWith(LIBRARY_PREFIX) && value.endsWith(')')) {
		return { type: 'library', id: value.slice(LIBRARY_PREFIX.length, -1) }
	}
	if (value.startsWith('data:')) {
		return { type: 'inline', dataUrl: value }
	}
	return { type: 'none' }
}

export const ImageInputField = observer(function ImageInputField({
	id,
	value,
	setValue,
	disabled,
	min,
	max,
}: ImageInputFieldProps): React.JSX.Element {
	const { imageLibrary } = useContext(RootAppStoreContext)
	const modalRef = useRef<ImagePickerModalRef>(null)

	const parsed = parseValue(value)

	const libraryImage = parsed.type === 'library' ? imageLibrary.getImage(parsed.id) : undefined

	const openModal = useCallback(() => {
		modalRef.current?.show('library')
	}, [])

	const clearImage = useCallback(() => {
		setValue(null)
	}, [setValue])

	let thumbnail: React.ReactNode
	let label: React.ReactNode

	if (parsed.type === 'library') {
		if (libraryImage) {
			thumbnail = <LibraryImageThumbnail imageName={libraryImage.name} checksum={libraryImage.checksum} />
			label = libraryImage.description || libraryImage.name
		} else {
			thumbnail = <FontAwesomeIcon icon={faImage} className="image-input-field__placeholder-icon" />
			label = <span className="text-muted">Unknown library image</span>
		}
	} else if (parsed.type === 'inline') {
		thumbnail = <img src={parsed.dataUrl} alt="Custom image" className="image-input-field__thumbnail" />
		label = 'Custom image'
	} else {
		thumbnail = <FontAwesomeIcon icon={faImage} className="image-input-field__placeholder-icon" />
		label = <span className="text-muted">No image selected</span>
	}

	return (
		<>
			<ImagePickerModal ref={modalRef} setValue={setValue} min={min} max={max} />
			<div id={id} className="image-input-field d-flex align-items-center gap-2">
				<div className="image-input-field__preview">{thumbnail}</div>
				<div className="image-input-field__label flex-grow-1 text-truncate">{label}</div>
				<ButtonGroup>
					<Button color="primary" onClick={openModal} disabled={disabled}>
						Browse…
					</Button>
					<Button
						color="danger"
						onClick={clearImage}
						disabled={disabled || parsed.type === 'none'}
						aria-label="Clear image"
						title="Clear image"
					>
						<FontAwesomeIcon icon={faTrash} />
					</Button>
				</ButtonGroup>
			</div>
		</>
	)
})
