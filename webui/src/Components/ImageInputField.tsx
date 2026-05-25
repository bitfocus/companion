import { faFolderOpen, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useRef, useState } from 'react'
import { Button, ButtonGroup } from '~/Components/Button'
import { blobToDataURL } from '~/Helpers/FileUpload.js'
import { DismissableAlert } from './Alert.js'

const allowedImageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']

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

export function ImageInputField({
	id,
	value,
	setValue,
	disabled,
	min = { width: 8, height: 8 },
	max = { width: 400, height: 400 },
}: ImageInputFieldProps): React.JSX.Element {
	const [imageLoadError, setImageLoadError] = useState<string | null>(null)

	const setImageDataAndClearError = useCallback(
		(data: string | null, _name: string) => {
			setImageLoadError(null)
			setValue(data)
		},
		[setValue]
	)

	const inputRef = useRef<HTMLInputElement>(null)

	const apiIsSupported = !!(window.File && window.FileReader && window.FileList && window.Blob)

	const imageResize = (img: HTMLImageElement, maxWidth: number, maxHeight: number) => {
		const canvas = document.createElement('canvas')
		let width = img.width
		let height = img.height

		if (width >= height) {
			if (width > maxWidth) {
				height *= maxWidth / width
				width = maxWidth
			}
		} else if (width < height) {
			if (height > maxHeight) {
				width *= maxHeight / height
				height = maxHeight
			}
		}

		canvas.width = width
		canvas.height = height

		const ctx = canvas.getContext('2d')
		if (!ctx) throw new Error('Not supported!')
		ctx.drawImage(img, 0, 0, width, height)
		return canvas.toDataURL()
	}

	const onClick = useCallback(() => {
		const fileForm = inputRef.current // "file" type of input form
		setImageLoadError(null)
		if (fileForm) {
			// ensure that the file is reloaded even if it has the same name as the current one:
			fileForm.value = ''
			fileForm.files = new DataTransfer().files // you can't create a FileList object directly (even though compiler doesn't complain)
			fileForm.click()
		}
	}, [setImageLoadError])
	const onChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newFiles = e.currentTarget.files
			console.log('change', newFiles)

			//check whether browser fully supports all File API
			if (apiIsSupported) {
				if (!newFiles || !newFiles.length || !allowedImageTypes.includes(newFiles[0].type)) {
					setImageLoadError('Sorry. Only PNG, JPEG, GIF, WebP or SVG files are supported.')
					return
				}

				Promise.resolve()
					.then(async () => {
						const imageSourceStr = await blobToDataURL(newFiles[0])

						// file is loaded
						const img = new Image()

						img.onload = () => {
							// image is loaded; sizes are available
							if (max && (img.height > max.height || img.width > max.width)) {
								setImageDataAndClearError(imageResize(img, max.width, max.height), newFiles[0].name)
							} else if (min && (img.width < min.width || img.height < min.height)) {
								setImageLoadError(`Image dimensions must be at least ${min.width}x${min.height}`)
							} else {
								setImageDataAndClearError(imageSourceStr, newFiles[0].name)
							}
						}

						img.src = imageSourceStr
					})
					.catch((err) => {
						setImageLoadError(`Error reading file: ${err}`)
						console.error('Error reading file:', err)
					})
			} else {
				setImageLoadError('Companion requires a newer browser')
			}
		},
		[min, max, apiIsSupported, setImageDataAndClearError, setImageLoadError]
	)

	const clearImage = useCallback(() => {
		setImageLoadError(null)
		setValue(null)
	}, [setValue])

	return (
		<>
			<ButtonGroup className="d-block">
				<Button
					color="primary"
					onClick={onClick}
					disabled={!apiIsSupported || disabled}
					title={apiIsSupported ? undefined : 'Not supported in your browser'}
				>
					<FontAwesomeIcon icon={faFolderOpen} />
					<input
						id={id}
						className="d-none"
						type="file"
						accept="image/*"
						ref={inputRef}
						onChange={onChange}
						disabled={!apiIsSupported || disabled}
					/>
				</Button>
				<Button
					color="danger"
					disabled={disabled || !value}
					onClick={clearImage}
					aria-label="Clear image"
					title="Clear image"
				>
					<FontAwesomeIcon icon={faTrash} />
				</Button>
			</ButtonGroup>
			<DismissableAlert color="warning" visible={!!imageLoadError} onClose={() => setImageLoadError(null)}>
				{imageLoadError}
			</DismissableAlert>
		</>
	)
}
