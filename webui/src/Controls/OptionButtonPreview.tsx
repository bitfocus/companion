import React, { useContext, useState } from 'react'
import { nanoid } from 'nanoid'
import { ButtonPreviewBase } from '../Components/ButtonPreview.js'
import { SocketContext, socketEmitPromise } from '../util.js'
import { useDeepCompareEffect } from 'use-deep-compare'
import { ControlLocation } from '@companion/shared/Model/Common.js'

interface OptionButtonPreviewProps {
	location: ControlLocation
	options: Record<string, any>
}

/**
 * Preview a button based on the selected options
 * @param {string} param.location where this preview is located (if any)
 * @returns
 */
export function OptionButtonPreview({ location, options }: OptionButtonPreviewProps) {
	const socket = useContext(SocketContext)

	const [image, setImage] = useState<string | null>(null)
	useDeepCompareEffect(() => {
		const id = nanoid()
		socketEmitPromise(socket, 'preview:button-reference:subscribe', [id, location, options])
			.then((newImage) => {
				console.log('got image', newImage)
				setImage(newImage)
			})
			.catch((err) => {
				console.error('Subscribe failure', err)
				setImage(null)
			})

		const updateImage = (newImage: string) => {
			setImage(newImage)
		}

		socket.on(`preview:button-reference:update:${id}`, updateImage)

		return () => {
			socketEmitPromise(socket, 'preview:button-reference:unsubscribe', [id]).catch((err) => {
				console.error('Unsubscribe failure', err)
			})
			socket.off(`preview:button-reference:update:${id}`, updateImage)
		}

		// TODO - is this too reactive watching all the options?
	}, [location, options])

	return <ButtonPreviewBase fixedSize preview={image} /> // TODO - noPad?
}
