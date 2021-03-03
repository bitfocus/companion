import React, { useCallback, useRef } from 'react'
import { CButton, CInputFile } from '@coreui/react'

export function PNGInputField({ definition, onSelect, onError }) {
	const inputRef = useRef()

	const apiIsSupported = !!(window.File && window.FileReader && window.FileList && window.Blob)

	const onClick = useCallback(() => {
		onError(null)
		inputRef.current.click()
	}, [onError])
	const onChange = useCallback(
		(e) => {
			const newFiles = e.currentTarget.files
			e.currentTarget.files = null
			console.log('change', newFiles)

			//check whether browser fully supports all File API
			if (apiIsSupported) {
				if (!newFiles.length || newFiles[0].type !== 'image/png') {
					onError('Sorry. Only proper PNG files are supported.')
					return
				}

				var fr = new FileReader()
				fr.onload = () => {
					// file is loaded
					var img = new Image()

					img.onload = () => {
						// image is loaded; sizes are available
						if (definition?.min && (img.width < definition.min.width || img.height < definition.min.height)) {
							onError(`Image dimensions must be at least ${definition.min.width}x${definition.min.height}`)
						} else if (definition?.max && (img.width > definition.max.width || img.height > definition.max.height)) {
							onError(`Image dimensions must be at most ${definition.max.width}x${definition.max.height}`)
						} else {
							onError(null)
							onSelect(fr.result, newFiles[0].name)
						}
					}

					img.src = fr.result // is the data URL because called with readAsDataURL
				}
				fr.readAsDataURL(newFiles[0])
			} else {
				onError('Companion requires a newer browser')
			}
		},
		[definition, apiIsSupported, onSelect, onError]
	)

	return (
		<CButton
			color="primary"
			className="pnginputfield"
			onClick={onClick}
			disabled={!apiIsSupported}
			title={apiIsSupported ? undefined : 'Not supported in your browser'}
		>
			Browse
			<CInputFile innerRef={inputRef} onChange={onChange} disabled={!apiIsSupported} />
		</CButton>
	)
}
