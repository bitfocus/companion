import React, { useContext, useState } from 'react'
import { nanoid } from 'nanoid'
import { ButtonPreviewBase } from '~/Components/ButtonPreview.js'
import { SocketContext } from '~/util.js'
import { useDeepCompareEffect } from 'use-deep-compare'

interface OptionButtonPreviewProps {
	controlId: string
	options: Record<string, any>
}

/**
 * Preview a button based on the selected options
 * @param {string} param.location where this preview is located (if any)
 * @returns
 */
export function OptionButtonPreview({ controlId, options }: OptionButtonPreviewProps): React.JSX.Element {
	const socket = useContext(SocketContext)

	const [image, setImage] = useState<string | null>(null)
	useDeepCompareEffect(() => {
		const id = nanoid()
		socket
			.emitPromise('preview:button-reference:subscribe', [id, controlId, options])
			.then((newImage) => {
				console.log('got image', newImage)
				setImage(newImage)
			})
			.catch((err) => {
				console.error('Subscribe failure', err)
				setImage(null)
			})

		const unsubUpdates = socket.on(`preview:button-reference:update:${id}`, (newImage) => {
			setImage(newImage)
		})

		return () => {
			socket.emitPromise('preview:button-reference:unsubscribe', [id]).catch((err) => {
				console.error('Unsubscribe failure', err)
			})
			unsubUpdates()
		}

		// TODO - is this too reactive watching all the options?
	}, [location, options])

	return <ButtonPreviewBase fixedSize preview={image} /> // TODO - noPad?
}
