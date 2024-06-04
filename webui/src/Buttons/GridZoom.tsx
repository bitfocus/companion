import { useMemo, useState } from 'react'

export const ZOOM_MIN = 50
export const ZOOM_MAX = 200
export const ZOOM_STEP = 10

export interface GridZoomController {
	zoomIn: (noLimit?: boolean) => void
	zoomOut: (noLimit?: boolean) => void
	zoomReset: () => void
	setZoom: (value: number) => void
}

function storeZoomValue(id: string, value: number) {
	// Cache the value for future page loads
	window.localStorage.setItem(`grid-zoom-scale:${id}`, value + '')
}

export function useGridZoom(id: string): [GridZoomController, number] {
	const [gridZoom, setGridZoom] = useState(() => {
		// load the cached value, or start with default
		const storedZoom = Number(window.localStorage.getItem(`grid-zoom-scale:${id}`))
		return storedZoom && !isNaN(storedZoom) ? storedZoom : 100
	})

	const controller = useMemo<GridZoomController>(() => {
		return {
			zoomIn: (noLimit) => {
				setGridZoom((oldValue) => {
					let newValue = oldValue + ZOOM_STEP
					if (!noLimit) newValue = Math.min(newValue, ZOOM_MAX)

					storeZoomValue(id, newValue)

					return newValue
				})
			},
			zoomOut: (noLimit) => {
				setGridZoom((oldValue) => {
					let newValue = oldValue - ZOOM_STEP
					if (!noLimit) newValue = Math.max(newValue, ZOOM_MIN)
					else newValue = Math.max(newValue, 10)

					storeZoomValue(id, newValue)

					return newValue
				})
			},
			zoomReset: () => {
				setGridZoom(100)
				storeZoomValue(id, 100)
			},
			setZoom: (value: number) => {
				setGridZoom(value)
				storeZoomValue(id, value)
			},
		}
	}, [id, setGridZoom])

	return [controller, gridZoom]
}
