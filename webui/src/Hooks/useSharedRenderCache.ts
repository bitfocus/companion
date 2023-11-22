import { useContext, useEffect, useMemo, useState } from 'react'
import { SocketContext, socketEmitPromise } from '../util'
import { nanoid } from 'nanoid'
import { ControlLocation } from '@companion/shared/Model/Common'

interface ImageState {
	image: string | null
	isUsed: boolean
}

/**
 * Load and retrieve a page from the shared button render cache
 * @param location Location of the control to load
 * @param disable Disable loading of this page
 * @returns
 */
export function useButtonRenderCache(location: ControlLocation, disable = false) {
	const socket = useContext(SocketContext)

	const subId = useMemo(() => nanoid(), [])

	// TODO - should these be managed a bit more centrally, and batched? It is likely that lots of subscribe/unsubscribe calls will happen at once (changing page/scrolling)

	const [imageState, setImageState] = useState<ImageState>({ image: null, isUsed: false })

	useEffect(() => {
		if (disable) return

		let terminated = false

		socketEmitPromise(socket, 'preview:location:subscribe', [location, subId])
			.then((imageData) => {
				if (terminated) {
					socketEmitPromise(socket, 'preview:location:unsubscribe', [location, subId]).catch((e) => {
						console.error(e)
					})
				} else {
					setImageState(imageData)
				}
			})
			.catch((e) => {
				console.error(e)
			})

		const changeHandler = (renderLocation: ControlLocation, image: string | null, isUsed: boolean) => {
			if (terminated) return

			if (
				location.pageNumber === renderLocation.pageNumber &&
				location.row === renderLocation.row &&
				location.column === renderLocation.column
			) {
				setImageState({ image, isUsed })
			}
		}

		socket.on('preview:location:render', changeHandler)

		return () => {
			terminated = true
			socketEmitPromise(socket, 'preview:location:unsubscribe', [location, subId]).catch((e) => {
				console.error(e)
			})

			socket.off('preview:location:render', changeHandler)
		}
	}, [socket, subId, location.pageNumber, location.row, location.column, disable])

	return imageState
}
