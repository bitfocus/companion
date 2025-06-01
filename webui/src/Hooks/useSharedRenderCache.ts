import { useContext, useEffect, useState } from 'react'
import { SocketContext } from '~/util.js'
import { nanoid } from 'nanoid'
import { ControlLocation, WrappedImage } from '@companion-app/shared/Model/Common.js'

/**
 * Load and retrieve a page from the shared button render cache
 * @param location Location of the control to load
 * @param disable Disable loading of this page
 * @returns
 */
export function useButtonRenderCache(location: ControlLocation, disable = false) {
	const socket = useContext(SocketContext)

	// TODO - should these be managed a bit more centrally, and batched? It is likely that lots of subscribe/unsubscribe calls will happen at once (changing page/scrolling)

	const [imageState, setImageState] = useState<WrappedImage>({ image: null, isUsed: false })

	useEffect(() => {
		if (disable) return

		const subId = nanoid()

		let terminated = false

		socket
			.emitPromise('preview:location:subscribe', [location, subId])
			.then((imageData) => {
				if (terminated) {
					socket.emitPromise('preview:location:unsubscribe', [location, subId]).catch((e) => {
						console.error(e)
					})
				} else {
					setImageState(imageData)
				}
			})
			.catch((e) => {
				console.error(e)
			})

		const unsubChange = socket.on('preview:location:render', (renderLocation, image, isUsed) => {
			if (terminated) return

			if (
				location.pageNumber === renderLocation.pageNumber &&
				location.row === renderLocation.row &&
				location.column === renderLocation.column
			) {
				setImageState({ image, isUsed })
			}
		})

		return () => {
			terminated = true
			socket.emitPromise('preview:location:unsubscribe', [location, subId]).catch((e) => {
				console.error(e)
			})

			unsubChange()
		}
	}, [socket, location.pageNumber, location.row, location.column, disable])

	return imageState
}
