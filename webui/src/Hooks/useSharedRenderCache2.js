import { useContext, useEffect, useMemo, useState } from 'react'
import { SocketContext, socketEmitPromise } from '../util'
import { nanoid } from 'nanoid'

/**
 * Load and retrieve a page from the shared button render cache
 * @param {string} sessionId Unique id of this accessor
 * @param {number | undefined} page Page number to load and retrieve
 * @param {boolean | undefined} disable Disable loading of this page
 * @returns
 */
export function useButtonRenderCache(location, disable = false) {
	const socket = useContext(SocketContext)

	const subId = useMemo(() => nanoid(), [])

	// TODO - should these be managed a bit more centrally, and batched? It is likely that lots of subscribe/unsubscribe calls will happen at once (changing page/scrolling)

	const [imageState, setImageState] = useState({ image: null, isUsed: false })

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

		const changeHandler = (renderLocation, image, isUsed) => {
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
