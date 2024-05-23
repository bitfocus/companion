import React, { useCallback, useRef } from 'react'
import { CButton, CFormInput } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons'

interface MinMaxDimension {
	width: number
	height: number
}

interface PNGInputFieldProps {
	min: MinMaxDimension
	max: MinMaxDimension
	onSelect: (png64Str: string, name: string) => void
	onError: (err: string | null) => void
}

export function PNGInputField({ min, max, onSelect, onError }: PNGInputFieldProps) {
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
		onError(null)
		if (inputRef.current) {
			inputRef.current.click()
		}
	}, [onError])
	const onChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newFiles = e.currentTarget.files
			e.currentTarget.files = null
			console.log('change', newFiles)

			//check whether browser fully supports all File API
			if (apiIsSupported) {
				if (!newFiles || !newFiles.length || newFiles[0].type !== 'image/png') {
					onError('Sorry. Only proper PNG files are supported.')
					return
				}

				const fr = new FileReader()
				fr.onload = () => {
					// file is loaded
					const img = new Image()

					img.onload = () => {
						if (!fr.result) return

						// image is loaded; sizes are available
						if (max && (img.height > max.height || img.width > max.width)) {
							onError(null)
							onSelect(imageResize(img, max.width, max.height), newFiles[0].name)
						} else if (min && (img.width < min.width || img.height < min.height)) {
							onError(`Image dimensions must be at least ${min.width}x${min.height}`)
						} else if (max && (img.width > max.width || img.height > max.height)) {
							onError(`Image dimensions must be at most ${max.width}x${max.height}`)
						} else {
							onError(null)
							onSelect(fr.result.toString(), newFiles[0].name)
						}
					}

					if (fr.result) {
						img.src = fr.result.toString() // is the data URL because called with readAsDataURL
					}
				}
				fr.readAsDataURL(newFiles[0])
			} else {
				onError('Companion requires a newer browser')
			}
		},
		[min, max, apiIsSupported, onSelect, onError]
	)

	return (
		<CButton
			color="primary"
			className="pnginputfield"
			onClick={onClick}
			disabled={!apiIsSupported}
			title={apiIsSupported ? undefined : 'Not supported in your browser'}
		>
			<FontAwesomeIcon icon={faFolderOpen} />
			<CFormInput type="file" ref={inputRef} onChange={onChange} disabled={!apiIsSupported} />
		</CButton>
	)
}
